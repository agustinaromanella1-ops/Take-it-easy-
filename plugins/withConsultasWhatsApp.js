const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Declara que la app necesita ver a WhatsApp.
 *
 * Desde Android 11 una app no ve qué otras hay instaladas salvo que lo pida
 * en <queries>. Sin esto pasan dos cosas, las dos silenciosas:
 *
 * 1. `Linking.canOpenURL('whatsapp://…')` devuelve false aunque WhatsApp esté
 *    instalado, así que siempre caíamos al link web y el mensaje daba un
 *    rodeo por el navegador.
 * 2. Un intent explícito al paquete com.whatsapp o com.whatsapp.w4b —que es
 *    como se elige entre WhatsApp y Business— falla con
 *    ActivityNotFoundException. La función entera no habría andado.
 *
 * Se declaran los paquetes puntuales y no QUERY_ALL_PACKAGES a propósito:
 * ese permiso está restringido por Google Play y pedirlo sin calificar es
 * motivo de rechazo.
 */
const PAQUETES = ['com.whatsapp', 'com.whatsapp.w4b'];

module.exports = function withConsultasWhatsApp(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    manifest.queries = manifest.queries ?? [{}];
    const consultas = manifest.queries[0];
    consultas.package = consultas.package ?? [];

    for (const nombre of PAQUETES) {
      const yaEsta = consultas.package.some(
        (p) => p.$?.['android:name'] === nombre,
      );
      if (!yaEsta) consultas.package.push({ $: { 'android:name': nombre } });
    }

    return mod;
  });
};
