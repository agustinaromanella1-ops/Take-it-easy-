import React, { useCallback } from 'react';
import { View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Importadas por peso y no desde la raíz del paquete: el índice hace un
// require() de TODAS las variantes, así que importar de ahí mete los ~8 MB de
// las dos familias enteras en el APK para usar cuatro archivos.
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
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
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    PlayfairDisplay_700Bold,
  });

  // Si las tipografías no cargan, la app abre igual con la del sistema. Antes
  // el error se descartaba y la app quedaba para siempre en el splash, que es
  // mucho peor que verse distinta.
  const listo = fontsLoaded || fontError !== null;

  // Solo se llama desde la vista que se dibuja cuando `listo` ya es cierto.
  const onReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (!listo) return null;

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
