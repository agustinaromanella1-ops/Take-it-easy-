import React, { useCallback } from 'react';
import { View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MessagesProvider } from './src/state/MessagesContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ScreenBackground } from './src/components/ui';

// Sostenemos el splash hasta que estén las tipografías: si no, el primer
// dibujado sale con la fuente del sistema y un instante después salta a la
// buena. Ese salto se ve como si la app estuviera mal dibujada.
void SplashScreen.preventAutoHideAsync();

/** El degradado lo pinta la app entera, así que la navegación va transparente. */
const transparent = (base: Theme): Theme => ({
  ...base,
  colors: { ...base.colors, background: 'transparent' },
});

export default function App(): React.ReactElement | null {
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    PlayfairDisplay_700Bold,
  });

  const onReady = useCallback(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ScreenBackground>
        <View style={{ flex: 1 }} onLayout={onReady}>
          <MessagesProvider>
            <NavigationContainer
              theme={transparent(scheme === 'dark' ? DarkTheme : DefaultTheme)}
            >
              <RootNavigator />
            </NavigationContainer>
          </MessagesProvider>
        </View>
      </ScreenBackground>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
