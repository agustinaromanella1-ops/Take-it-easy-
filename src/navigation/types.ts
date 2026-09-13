import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabsParamList = {
  Scheduled: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  Compose: { id?: string } | undefined;
  Detail: { id: string };
  Templates: undefined;
};
