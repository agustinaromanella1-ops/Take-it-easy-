const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Saca del APK el ContentProvider que trae expo-clipboard.
 *
 * `ClipboardFileProvider` es una versión modificada de FileProvider que, según
 * su propio comentario, "must be exported": queda con
 * `android:exported="true"` y sin permiso, y cualquier app instalada puede
 * leer lo que haya en `cacheDir/.clipboard/`. Existe para poder copiar
 * *imágenes* al portapapeles.
 *
 * Nosotros solo copiamos texto (`setStringAsync`), así que esa carpeta nunca
 * tiene nada y el proveedor es superficie de ataque sin contrapartida —
 * además de lo que los analizadores de Google Play marcan como proveedor
 * exportado sin protección. Se lo saca con la misma herramienta con la que se
 * sacan los permisos que no usamos.
 *
 * Si algún día hiciera falta copiar una imagen al portapapeles, hay que
 * borrar este plugin: sin el proveedor, `setImageAsync` no funciona.
 */
const PROVEEDOR = 'expo.modules.clipboard.ClipboardFileProvider';

module.exports = function withSinProveedorDePortapapeles(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;

    app.provider = app.provider ?? [];
    const yaEsta = app.provider.some(
      (p) => p.$?.['android:name'] === PROVEEDOR,
    );
    if (!yaEsta) {
      // El manifest de la librería lo agrega al fusionar; esta entrada le
      // dice al fusionador que lo descarte.
      app.provider.push({
        $: { 'android:name': PROVEEDOR, 'tools:node': 'remove' },
      });
    }

    return mod;
  });
};
