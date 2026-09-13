import React from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MessagesProvider } from './src/state/MessagesContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App(): React.ReactElement {
  const scheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <MessagesProvider>
        <NavigationContainer
          theme={scheme === 'dark' ? DarkTheme : DefaultTheme}
        >
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </MessagesProvider>
    </SafeAreaProvider>
  );
}
