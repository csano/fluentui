import { TFabricPlatformPageProps } from '../../../interfaces/Platforms';
import { ScrollablePanePageProps as ExternalProps } from '@fluentui/react-examples/lib/react/ScrollablePane/ScrollablePane.doc';
import { ISideRailLink } from '@fluentui/react-docsite-components/lib/index2';

const related: ISideRailLink[] = [];

export const ScrollablePanePageProps: TFabricPlatformPageProps = {
  web: {
    ...(ExternalProps as any),
    related,
  },
};
