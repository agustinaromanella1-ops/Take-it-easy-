// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { Capacitor } from '@capacitor/core';

export function esNativa(): boolean {
  return Capacitor.isNativePlatform();
}

export function plataforma(): string {
  return Capacitor.getPlatform();
}
