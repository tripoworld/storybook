import memoize from 'memoizerific';
import Fuse from 'fuse.js';
import { DOCS_MODE } from 'global';
import { SyntheticEvent } from 'react';

const FUZZY_SEARCH_THRESHOLD = 0.4;

export const prevent = (e: SyntheticEvent) => {
  e.preventDefault();
  return false;
};

const toList = memoize(1)((dataset: Dataset) => Object.values(dataset));

export interface Item {
  id: string;
  depth: number;
  name: string;
  kind: string;
  isLeaf: boolean;
  isComponent: boolean;
  isRoot: boolean;
  parent: string;
  children: string[];
  parameters: Record<string, any>;
}

export type Dataset = Record<string, Item>;
export type SelectedSet = Record<string, boolean>;
export type ExpandedSet = Record<string, boolean>;

export const keyEventToAction = ({
  keyCode,
  ctrlKey,
  shiftKey,
  altKey,
  metaKey,
}: KeyboardEvent) => {
  if (shiftKey || metaKey || ctrlKey || altKey) {
    return false;
  }
  switch (keyCode) {
    case 18: {
      return 'ENTER';
    }
    case 32: {
      return 'SPACE';
    }
    case 38: {
      return 'UP';
    }
    case 40: {
      return 'DOWN';
    }
    case 37: {
      return DOCS_MODE ? 'UP' : 'LEFT';
    }
    case 39: {
      return DOCS_MODE ? 'DOWN' : 'RIGHT';
    }
    default: {
      return false;
    }
  }
};

export const createId = (id: string, prefix: string) => `${prefix}_${id}`;

export const get = memoize(1000)((id: string, dataset: Dataset) => dataset[id]);
export const getParent = memoize(1000)((id, dataset) => {
  const item = get(id, dataset);
  if (!item || item.isRoot) {
    return undefined;
  }
  return get(item.parent, dataset);
});
export const getParents = memoize(1000)((id: string, dataset: Dataset): Item[] => {
  const parent = getParent(id, dataset);

  if (!parent) {
    return [];
  }
  return [parent, ...getParents(parent.id, dataset)];
});

export const getMains = memoize(1)((dataset: Dataset) =>
  toList(dataset).filter(m => m.depth === 0)
);
const getMainsKeys = memoize(1)((dataset: Dataset) => getMains(dataset).map(m => m.id));

export const getPrevious = ({
  id,
  dataset,
  expanded,
}: {
  id: string;
  dataset: Dataset;
  expanded: ExpandedSet;
}): Item | undefined => {
  // STEP 1
  // find parent
  // if no previous sibling, use parent
  // unless parent is root
  //
  // STEP 2
  // find previous sibling
  // recurse into that sibling's last children that are expanded

  const current = get(id, dataset);
  const parent = getParent(id, dataset);
  const mains = getMainsKeys(dataset);

  const siblings = parent && parent.children ? parent.children : mains;
  const index = siblings.indexOf(current.id);

  if (index === 0) {
    if (parent && parent.isRoot) {
      return getPrevious({ id: parent.id, dataset, expanded });
    }
    if (!parent) {
      return undefined;
    }
    return parent;
  }

  let item = get(siblings[index - 1], dataset);

  while (item.children && expanded[item.id]) {
    item = get(item.children.slice(-1)[0], dataset);
  }

  if (item.isRoot) {
    return getPrevious({ id: item.id, dataset, expanded });
  }

  return item;
};

export const getNext = ({
  id,
  dataset,
  expanded,
}: {
  id: string;
  dataset: Dataset;
  expanded: ExpandedSet;
}): Item | undefined => {
  // STEP 1:
  // find any children if the node is expanded, first child
  //
  // STEP 2
  // iterate over parents, + fake 'root':
  // - find index of last parent as child in grandparent
  // - if child has next sibling, return
  // - if not, continue iterating
  const current = get(id, dataset);

  if (!current) {
    return undefined;
  }

  const { children } = current;

  if (children && children.length && (expanded[current.id] || current.isRoot)) {
    return get(children[0], dataset);
  }

  const mains = getMainsKeys(dataset);

  // we add a face super-root, otherwise we won't be able to jump to the next root
  const superRoot = { children: mains } as Item;
  const parents = getParents(id, dataset).concat([superRoot]);

  const next = parents.reduce(
    (acc, item) => {
      if (acc.result) {
        return acc;
      }
      const parent = item;
      const siblings = parent && parent.children ? parent.children : mains;
      const index = siblings.indexOf(acc.child.id);

      if (siblings[index + 1]) {
        return { result: get(siblings[index + 1], dataset) };
      }
      return { child: parent };
    },
    { child: current, result: undefined }
  );

  if (next.result && next.result.isRoot) {
    return getNext({ id: next.result.id, dataset, expanded });
  }
  return next.result;
};

const fuse = memoize(5)(
  dataset =>
    new Fuse(toList(dataset), {
      threshold: FUZZY_SEARCH_THRESHOLD,
      keys: ['kind', 'name', 'parameters.fileName', 'parameters.notes'],
    })
);

const exactMatch = memoize(1)(filter => (i: Item) =>
  (i.kind && i.kind.includes(filter)) ||
  (i.name && i.name.includes(filter)) ||
  (i.parameters && i.parameters.fileName && i.parameters.fileName.includes(filter)) ||
  (i.parameters && typeof i.parameters.notes === 'string' && i.parameters.notes.includes(filter))
);

export const toId = (base: string, addition: string) =>
  base === '' ? `${addition}` : `${base}-${addition}`;

export const toFiltered = (dataset: Dataset, filter: string) => {
  let found;
  if (filter.length && filter.length > 2) {
    found = fuse(dataset).search(filter);
  } else {
    found = toList(dataset).filter(exactMatch(filter));
  }

  // get all parents for all results
  const result = found.reduce((acc, item) => {
    getParents(item.id, dataset).forEach(pitem => {
      acc[pitem.id] = pitem;
    });

    acc[item.id] = item;
    return acc;
  }, {} as Dataset);

  // filter the children of the found items (and their parents) so only found entries are present
  return Object.entries(result).reduce((acc, [k, v]) => {
    acc[k] = v.children ? { ...v, children: v.children.filter(c => !!result[c]) } : v;
    return acc;
  }, {} as Dataset);
};
