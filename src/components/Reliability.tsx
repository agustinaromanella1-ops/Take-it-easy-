import React from 'react';
import { Platform, Text, View } from 'react-native';
import {
  describeReliability,
  type Reliability,
} from '../domain/reliability';
import {
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
  supportsBatterySettings,
  supportsExactAlarmSettings,
} from '../notifications/androidSetup';
import { radius, spacing, usePalette } from '../theme';
import { Button } from './ui';

/**
 * Los dos ajustes del sistema que deciden si un aviso llega puntual en Android.
 * No los podemos cambiar por ella, pero sí llevarla directo a la pantalla.
 */
export function AndroidReliabilityActions(): React.ReactElement | null {
  if (Platform.OS !== 'android') return null;

  return (
    <View style={{ gap: spacing(1) }}>
      {supportsExactAlarmSettings() ? (
        <Button
          label="Permitir alarmas exactas"
          variant="secondary"
          onPress={() => void openExactAlarmSettings()}
        />
      ) : null}
      {supportsBatterySettings() ? (
        <Button
          label="Quitar la optimización de batería"
          variant="secondary"
          onPress={() => void openBatteryOptimizationSettings()}
        />
      ) : null}
    </View>
  );
}

/** Aviso compacto arriba de la lista, solo cuando medimos retrasos reales. */
export function ReliabilityBanner({
  reliability,
}: {
  reliability: Reliability;
}): React.ReactElement | null {
  const p = usePalette();
  if (reliability.level !== 'degraded') return null;

  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: p.warningSoft,
        borderColor: p.warning,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing(2),
        marginTop: spacing(2),
      }}
    >
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
        Tus avisos están llegando tarde
      </Text>
      <Text
        style={{
          color: p.text,
          fontSize: 14,
          lineHeight: 20,
          marginTop: spacing(0.5),
        }}
      >
        {describeReliability(reliability)}{' '}
        {Platform.OS === 'android'
          ? 'Suele ser el ahorro de batería del teléfono. Se arregla desde los ajustes del sistema.'
          : 'Revisá que la app tenga permitido avisarte incluso en modo concentración.'}
      </Text>
      <View style={{ marginTop: spacing(1.5) }}>
        <AndroidReliabilityActions />
      </View>
    </View>
  );
}
