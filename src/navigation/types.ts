import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabsParamList = {
  Scheduled: undefined;
  History: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  Compose:
    | {
        id?: string;
        /** Copiar el texto para otra persona: el destinatario se elige de nuevo. */
        duplicateOf?: string;
        /** Volver a mandar lo mismo a la misma persona. */
        resendOf?: string;
      }
    | undefined;
  Detail: { id: string };
  Templates: undefined;
  Privacy: undefined;
};
