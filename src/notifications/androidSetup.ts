import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Dos ajustes del sistema deciden si nuestras notificaciones llegan a horario
 * en Android. No se pueden cambiar desde la app ni consultar desde JavaScript,
 * pero sí podemos llevar a la usuaria directo a la pantalla que corresponde.
 */

/** API 31 = Android 12, cuando aparecen las restricciones de alarmas exactas. */
const ANDROID_12 = 31;

export const supportsExactAlarmSettings = (): boolean =>
  Platform.OS === 'android' &&
  typeof Platform.Version === 'number' &&
  Platform.Version >= ANDROID_12;

export const supportsBatterySettings = (): boolean => Platform.OS === 'android';

/**
 * Pantalla del permiso de alarmas exactas para esta app. Sin él, Android puede
 * agrupar el aviso con otros y demorarlo para ahorrar batería.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (!supportsExactAlarmSettings()) return;

  const packageName = Application.applicationId;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.REQUEST_SCHEDULE_EXACT_ALARM',
      packageName ? { data: `package:${packageName}` } : {},
    );
  } catch {
    // Algunas capas de fabricante no exponen esa pantalla: caemos a los
    // ajustes generales de la app, desde donde igual se puede llegar.
    await Linking.openSettings();
  }
}

/**
 * Lista de optimización de batería del sistema. Abrimos la lista general en
 * lugar de pedir la exención directa: el pedido directo requiere un permiso
 * que Google Play restringe, y esta pantalla no necesita ninguno.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (!supportsBatterySettings()) return;

  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS',
    );
  } catch {
    await Linking.openSettings();
  }
}
