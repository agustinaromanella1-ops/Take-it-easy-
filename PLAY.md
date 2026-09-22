# Publicar en Google Play

La app es una PWA. Para Play se la envuelve en un paquete de Android (una TWA: el sistema
abre la app en pantalla completa, sin barra del navegador, cargándola desde el sitio
publicado). El código de la app **no cambia**: lo que se sube es una cáscara que apunta a
la dirección.

Eso tiene una consecuencia que conviene entender antes de empezar: **la dirección queda
grabada adentro del paquete**. Si algún día se cambia de dominio, hay que publicar una
versión nueva en Play. Por eso el orden importa.

## Antes de envolver nada

1. **Decidir la dirección definitiva.** Hoy es `pipi-cucu.agustina-romanella1.workers.dev`.
   Si se va a usar un dominio propio, hay que mudarse **primero**. Ver `CLOUDFLARE.md`.
2. **Los colores del manifiesto tienen que estar bien.** `background_color` es lo que
   Android pinta en la pantalla de arranque detrás del ícono. Cambiarlo después pide
   publicar una versión nueva. (Ya está: el celeste `#d9ebfb`.)
3. **La política de privacidad tiene que estar publicada y abrirse sin instalar nada.**
   Play pide una dirección pública. Ya está en `/privacidad.html`.

## El keystore, que es lo único irrecuperable

Al envolver la app se genera un archivo de firma —`signing.keystore`— con su contraseña.
**Cada actualización futura de la misma ficha de Play tiene que estar firmada con ese
mismo archivo.** Si se pierde, no hay forma de actualizar la app: hay que publicar una
ficha nueva, y quien la tenga instalada no recibe la actualización nunca.

Y al revés: quien tenga el archivo y la contraseña puede publicar actualizaciones
haciéndose pasar por la app.

Entonces:

- **Nunca** al repositorio. `.gitignore` ya bloquea `*.keystore`, `*.jks` y
  `keystore.properties`, pero la regla es no tentarse.
- **Nunca** en una captura de pantalla ni en un chat, ni conmigo ni con nadie.
- Sí en un gestor de contraseñas, con una copia en otro lado.

## El archivo que ata la app al sitio

Android necesita comprobar que quien publica la app es dueño del sitio. Eso se hace con
un archivo en `/.well-known/assetlinks.json`. Si falta o está mal, la app abre **con la
barra del navegador arriba**, como una página cualquiera: es la señal de que la
verificación falló.

Hace falta la **huella SHA-256** de la clave de firma. Es un dato público —no es la
contraseña— y sale así:

```bash
keytool -list -v -keystore signing.keystore -alias <el alias> | grep SHA256
```

El archivo va en `public/.well-known/assetlinks.json` y tiene esta forma:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "<el id del paquete, ej. ar.com.pipicucu>",
    "sha256_cert_fingerprints": ["<la huella, con los dos puntos>"]
  }
}]
```

Comprobado: un archivo ahí sobrevive a la compilación y **no** queda guardado en la caché
del service worker, que es lo que corresponde —Android tiene que poder leerlo fresco—.

Pasame la huella y el id del paquete y lo creo. La contraseña no me la pases.

Después de publicar, se comprueba abriendo
`https://<la dirección>/.well-known/assetlinks.json` en el navegador: tiene que devolver
el JSON, no el index de la app.

## La declaración de seguridad de datos

Play pregunta qué datos recopila la app. Las respuestas de abajo valen para **la app como es
hoy**: todo se queda en el dispositivo y no hay nada que viaje. Si alguna vez se publica con
sincronización entre dispositivos, tres de estas respuestas dejan de ser ciertas y hay que
rehacer la declaración: está detallado en `SINCRONIZACION.md`, en "Lo que cambia en Play".
Presentar la declaración vieja sería declarar algo falso.

Las respuestas, con el porqué:

| Pregunta | Respuesta | Por qué |
|---|---|---|
| ¿Recopila o comparte datos de usuarios? | **No** | Todo queda en el dispositivo. No hay servidor, ni analítica, ni terceros. Play considera "recopilado" lo que sale del equipo. |
| ¿Los datos se procesan solo en el dispositivo? | **Sí** | Es literal: `localStorage`, sin una sola llamada de red. |
| ¿Se pueden borrar los datos? | **Sí** | Desinstalando, o borrando los datos del sitio desde el navegador. La política lo explica. |

Dos cosas que hay que declarar aparte y son fáciles de pasar por alto:

- **El permiso de notificaciones.** Desde que existe el aviso de turno, la app puede pedir
  el permiso del sistema. Solo si la persona lo prende, y viene apagado — pero el permiso
  hay que declararlo igual.
- **La declaración de apps de salud.** La app guarda nombres de pacientes y notas de
  sesión: son datos de salud **de terceros**. Play tiene un formulario aparte para esto y
  equivocarse ahí es de las cosas que hacen bajar una ficha. Conviene leer el formulario
  vigente y contestarlo con cuidado; lo de acá arriba es un borrador, no asesoramiento
  legal, y las políticas de Play cambian seguido.

## La ficha

**Nombre:** Pipí Cucú

**Descripción corta** (80 caracteres):

> Tu agenda, pipí cucú. Pacientes, sesiones y honorarios, sin que salgan del celular.

**Descripción completa:**

> Pipí Cucú es una agenda para consultorio: pacientes, sesiones y honorarios en un solo
> lugar, hecha para que usarla no dependa de acordarte de nada.
>
> Arriba de todo está lo que sigue, y lo más grande es cuánto falta, no la hora. Abajo, una
> sola cosa por vez de lo que quedó abierto, con su botón al lado. Todo lo que tocás se
> puede deshacer. Lo que escribís no se pierde si se cierra una pantalla.
>
> • Pacientes, con su honorario, su frecuencia y sus datos de facturación.
> • Agenda por día, semana y mes, con series de turnos que se cargan de una vez.
> • Cierre del día: marcás todas las sesiones juntas con sus cobros, y termina con el
>   resumen de la jornada.
> • Finanzas: lo facturado y lo cobrado del mes, quién tiene saldo, y el texto de la
>   factura listo para copiar.
> • Planillas para Excel y copia de seguridad.
> • Funciona sin internet. Modo claro y oscuro.
>
> Tus datos no salen de tu teléfono. No hay cuentas, ni servidores, ni publicidad, ni
> analítica. Nadie más los ve: tampoco nosotros. Por eso la copia de seguridad es parte de
> la app y conviene hacerla cada tanto.

**Capturas:** hacen falta al menos dos, de teléfono. Se pueden sacar de la app andando; las
pantallas que mejor la cuentan son Inicio (con "lo que sigue" y una cosa pendiente), la
Agenda del día y el cierre del día con su resumen.

**Categoría:** Medicina, o Productividad. Medicina describe mejor a quién sirve; Productividad
tiene menos requisitos. Si se elige Medicina, la declaración de apps de salud es obligatoria.

## Lo que hago yo y lo que tenés que hacer vos

**Yo:** el archivo de enlace cuando me pases la huella, cualquier cambio que haga falta en
el manifiesto o los íconos, y los textos.

**Vos:** la cuenta de desarrollador (US$ 25, una sola vez), generar y guardar el keystore,
subir el paquete, cargar la ficha y contestar los formularios. Eso pide tu identidad y tu
tarjeta, así que no hay forma de que lo haga otro.
