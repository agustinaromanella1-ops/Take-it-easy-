import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScheduledListScreen } from '../screens/ScheduledListScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { MessageDetailScreen } from '../screens/MessageDetailScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { useMessages } from '../state/MessagesContext';
import { BORDER_WIDTH, fonts, usePalette } from '../theme';
import type { RootStackParamList, TabsParamList } from './types';
import { Txt } from '../components/ui';

const Tab = createBottomTabNavigator<TabsParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const icon =
  (glyph: string) =>
  ({ color }: { color: string }) => (
    <Txt style={{ fontSize: 20, color }}>{glyph}</Txt>
  );

function Tabs(): React.ReactElement {
  const p = usePalette();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accentInk,
        tabBarInactiveTintColor: p.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: p.surface,
          // El contorno es parte del dibujo, también acá.
          borderTopColor: p.border,
          borderTopWidth: BORDER_WIDTH,
        },
      }}
    >
      <Tab.Screen
        name="Scheduled"
        component={ScheduledListScreen}
        options={{ title: 'Programados', tabBarIcon: icon('🕘') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'Historial', tabBarIcon: icon('✓') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Ajustes', tabBarIcon: icon('⚙') }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator(): React.ReactElement | null {
  const p = usePalette();
  const { ready, onboardingCompleted } = useMessages();

  // Esperamos a leer la preferencia antes de decidir qué mostrar: si no,
  // la explicación aparecería un instante en cada arranque.
  if (!ready) return null;
  if (!onboardingCompleted) return <OnboardingScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: p.ink,
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 19 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={Tabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Compose"
        component={ComposeScreen}
        options={{ presentation: 'modal', title: 'Nuevo mensaje' }}
      />
      <Stack.Screen
        name="Detail"
        component={MessageDetailScreen}
        options={{ title: 'Mensaje' }}
      />
      <Stack.Screen
        name="Templates"
        component={TemplatesScreen}
        options={{ title: 'Plantillas' }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ title: 'Privacidad' }}
      />
    </Stack.Navigator>
  );
}
