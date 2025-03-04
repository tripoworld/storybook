import React, { Fragment, ComponentType, FunctionComponent } from 'react';

import { State } from '@storybook/api';
import * as S from './container';

interface DesktopProps {
  width: number;
  panelCount: number;
  height: number;
  Nav: ComponentType<any>;
  Preview: ComponentType<any>;
  Panel: ComponentType<any>;
  Notifications: ComponentType<any>;
  pages: {
    key: string;
    route: FunctionComponent;
    render: ComponentType;
  }[];
  options: State['layout'];
  viewMode: string;
  docsOnly: boolean;
}

const Desktop = React.memo<DesktopProps>(
  ({
    Panel,
    Nav,
    Preview,
    Notifications,
    pages,
    options,
    viewMode = undefined,
    width = 0,
    height = 0,
    panelCount,
    docsOnly = false,
  }) => (
    <Fragment>
      <Notifications
        placement={{
          position: 'fixed',
          bottom: 20,
          left: 20,
        }}
      />
      {width && height ? (
        <S.Layout
          options={options}
          bounds={{ width, height, top: 0, left: 0 }}
          viewMode={viewMode}
          docsOnly={!!docsOnly}
          panelCount={panelCount}
        >
          {({ navProps, mainProps, panelProps, previewProps }) => (
            <Fragment>
              <S.Nav {...navProps}>
                <Nav debug={navProps} />
              </S.Nav>
              <S.Main {...mainProps} isFullscreen={!!mainProps.isFullscreen}>
                <S.Preview {...previewProps} hidden={viewMode === 'settings'}>
                  <Preview id="main" debug={previewProps} />
                </S.Preview>

                <S.Panel {...panelProps} hidden={viewMode !== 'story' || docsOnly}>
                  <Panel debug={panelProps} />
                </S.Panel>

                {pages.map(({ key, route: Route, render: Content }) => (
                  <Route key={key}>
                    <Content />
                  </Route>
                ))}
              </S.Main>
            </Fragment>
          )}
        </S.Layout>
      ) : (
        <div title={JSON.stringify({ width, height })} />
      )}
    </Fragment>
  )
);

Desktop.displayName = 'DesktopLayout';

export { Desktop };
