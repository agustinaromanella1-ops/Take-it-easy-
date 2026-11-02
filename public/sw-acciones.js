/*
 * Lo que pasa cuando se toca una notificación de Pipí Cucú.
 *
 * Vive aparte del service worker que genera Workbox porque ese se regenera en
 * cada compilación; este se le engancha con `workbox.importScripts` desde
 * `vite.config.ts`. Tocarlo no toca la maquinaria de actualización, que ya se
 * rompió dos veces.
 *
 * Dos caminos y los dos tienen que funcionar:
 *
 * - La app ya está abierta (aunque sea en segundo plano): se le trae al frente
 *   la ventana que ya existe y se le avisa por `postMessage`. Abrir una nueva
 *   dejaría dos copias de la app escribiendo sobre los mismos datos.
 * - La app está cerrada: se abre con la respuesta en la dirección, y la app la
 *   lee al arrancar.
 *
 * El botón que se tocó viene en `event.action`; tocar el cuerpo del aviso no
 * manda ninguno, y ahí la app solo abre la pantalla que corresponde. En iOS
 * los botones no existen: queda ese camino, que es el que importa que ande.
 */
self.addEventListener('notificationclick', (event) => {
  const accion = event.action || '';
  const datos = event.notification.data || {};
  event.notification.close();

  event.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const cliente of abiertas) {
        if (!cliente.url.startsWith(self.location.origin)) continue;
        cliente.postMessage({ tipo: 'pipicucu:accion', accion, sesion: datos.sesion || null });
        if ('focus' in cliente) await cliente.focus();
        return;
      }

      const destino = new URL('/', self.location.origin);
      if (accion) destino.searchParams.set('hacer', accion);
      if (datos.sesion) destino.searchParams.set('sesion', datos.sesion);
      await self.clients.openWindow(destino.href);
    })(),
  );
});
