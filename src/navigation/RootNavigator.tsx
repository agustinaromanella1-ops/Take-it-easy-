import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScheduledListScreen } from '../screens/ScheduledListScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ComposeScreen } from '../screens/ComposeScreen';
import { MessageDetailScreen } from '../screens/MessageDetailScreen';
import { usePalette } from '../theme';
import type { RootStackParamList, TabsParamList } from './types';

const Tab = createBottomTabNavigator<TabsParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const icon =
  (glyph: string) =>
  ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{glyph}</Text>
  );

function Tabs(): React.ReactElement {
  const p = usePalette();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.textMuted,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border },
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

export function RootNavigator(): React.ReactElement {
  const p = usePalette();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: p.bg },
        headerTintColor: p.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: p.bg },
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
    </Stack.Navigator>
  );
}
