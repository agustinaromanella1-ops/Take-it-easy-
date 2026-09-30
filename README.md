# Take it easy — Listo para enviar

App de celular (iOS y Android) para **escribir mensajes ahora y programar su envío por
WhatsApp** para el día y la hora que elijas. Para esos casos en los que querés responder
en el momento en que lo pensás, pero no es el día ni el horario conveniente.

El prompt original que dio origen a la app está en
[`prompts/app-mensajes-programados-whatsapp.md`](prompts/app-mensajes-programados-whatsapp.md).

## Cómo funciona el envío

WhatsApp **no permite** que una app de terceros mande mensajes sola desde una cuenta
personal. Las librerías no oficiales que automatizan WhatsApp Web violan los términos de
servicio y llevan a que baneen el número, así que este proyecto no las usa.

El modelo es **"listo para enviar"**:

1. Guardás el mensaje y el momento elegido.
2. A la hora indicada suena una notificación local, con la app cerrada o el celu bloqueado.
3. Al tocarla se abre WhatsApp en el chat de esa persona **con el texto ya escrito**.
4. Tocás enviar. Un toque.

La app nunca dice que el mensaje "se envió solo": lo que promete es dejártelo listo en el
momento justo, y eso es exactamente lo que hace.

## Development build

Las notificaciones locales programadas no son confiables en Expo Go, así que para probar
el flujo real hace falta un *development build*: una app tuya, instalada en el teléfono,
que después levanta el código desde tu máquina. Se compila una sola vez.

**Camino recomendado — EAS Build (en la nube, no necesitás Android Studio ni Xcode):**

```bash
npm install
npm install -g eas-cli
eas login                              # cuenta gratuita de Expo
eas build --profile development --platform android
```

Cuando termina te da un link y un QR: lo abrís desde el celular, instalás el APK y listo.
Después, cada vez que quieras trabajar:

```bash
npx expo start --dev-client
```

Para **iOS** el mismo comando con `--platform ios`, pero ahí sí hace falta una cuenta de
Apple Developer (100 USD al año) para instalar en un teléfono físico. Si tenés una Mac,
`npx expo run:ios` con el simulador sale gratis.

**Camino local (si ya tenés Android Studio instalado):**

```bash
npx expo run:android
```

El perfil `development` ya está configurado en [`eas.json`](eas.json).

> En Android 13+ el permiso de notificaciones se pide en tiempo de ejecución: lo hace la
> app cuando programás tu primer mensaje.

Verificaciones:

```bash
npm run typecheck   # tsc --noEmit
npm test            # 83 tests sobre la lógica de dominio
```

## Sistema visual

Tomado de **Pipí Cucú** (rama `main` de este mismo repo), para que las dos apps se lean
como hermanas. Lo que lo define:

- **Atardecer con verde agua.** El fondo es un degradado de verde agua `#ddf2ec` arriba,
  donde todavía queda día, a lila `#f1ecf9`, a durazno `#fff0e6` sobre el horizonte. Lo
  pinta la app entera una sola vez, no cada pantalla: así no hay costuras al navegar.
- **El contorno es parte del dibujo**, no una línea de separación: 2,5 px en tinta
  `#123f3c`, un verde profundo, no un gris finito.
- **La sombra es dura y sin desenfoque.** Es lo que da el aire de calcomanía pegada sobre
  la página en vez de flotando encima.
- **Playfair Display** para títulos y **Nunito** para el cuerpo.
- **Coral `#ff9c80` para la acción principal**, con tinta encima y no blanco.
- Al apretar, los botones **se hunden** hasta donde estaba su sombra.
- El oscuro no es el claro dado vuelta: es el mismo atardecer más tarde, el verde agua
  apagado en noche y el durazno como un resto de ciruela, con el contorno aclarado porque
  sobre oscuro una línea oscura no se ve.

**El contraste está medido por un test, no de palabra.** `src/__tests__/contraste.test.ts`
calcula la relación WCAG 2.1 de cada par de texto sobre fondo —incluido el texto sobre las
tres paradas del degradado— y falla si alguno baja de 4,5:1 (3:1 para contornos). Así,
aclarar la paleta no puede romper la legibilidad en silencio: fue justamente ese test el
que obligó a aclarar el coral del botón principal, porque con el naranja anterior la tinta
encima daba 4,34:1.

Para mirar la paleta sin esperar a que compile el APK: `node icono/vista-previa.mjs` dibuja
la pantalla principal en los dos modos leyendo los valores de `theme.ts`.

**La sombra dura no usa las sombras nativas.** En Android `elevation` siempre desenfoca y
no acepta desplazamiento, así que el efecto no se puede reproducir con las propiedades del
sistema. El componente `HardShadow` la dibuja: un rectángulo del mismo tamaño, corrido,
pintado detrás del contenido. Se ve idéntica en Android y en iOS.

**Las tipografías propias rompen `fontWeight`:** con una fuente cargada a mano, el peso ya
no elige el archivo correcto, hay que nombrar la familia de cada uno. El componente `Txt`
lo resuelve solo — lee el peso del estilo, elige la familia y neutraliza el `fontWeight`
para que Android no aplique encima una negrita sintética. Por eso en las pantallas se usa
`Txt` y no `Text`.

## Estructura

```
src/
  domain/      lógica pura, sin dependencias de React Native (todo testeado)
    types.ts     el modelo ScheduledMessage y sus estados
    phone.ts     normalización a E.164, con el caso argentino del 9
    time.ts      hora de pared ↔ instante UTC
    schedule.ts  atajos ("Mañana 9:00") y corrimientos ("+1 día")
    grouping.ts  agrupación por día, etiquetas "Hoy"/"Mañana"/"Viernes 18"
    recurrence.ts  repeticiones (FREQ=WEEKLY) y cálculo de la próxima
    quietHours.ts  franja horaria permitida
    templates.ts   variables {nombre} y su reemplazo
    backup.ts      exportar e importar, con validación del archivo
    adjunto.ts     el archivo que va con el mensaje: tipos, límites, nombres
    reliability.ts puntualidad medida de los avisos
    whatsapp.ts  armado de los deep links
  db/          SQLite local con migraciones versionadas
  files/       copias propias de los archivos adjuntos y su limpieza
  notifications/  agendado y cancelación de avisos locales
  state/       MessagesContext: une base, notificaciones y ciclo de vida
  components/  UI reutilizable (ui.tsx tiene Txt, HardShadow y los controles)
  theme.ts     los tokens del sistema visual: colores, radios, sombras, fuentes
  screens/     Primer uso, Programados, Nuevo/Editar, Detalle, Historial,
               Plantillas, Privacidad, Ajustes
```

## Estados de un mensaje

```
draft ──(se le pone fecha)──> scheduled ──(suena el aviso)──> fired ──(confirmó)──> sent
                                  ▲                             │
                                  └────────(posponer)───────────┤
                                                                └──> skipped
```

Un mensaje `scheduled` cuya hora ya pasó se muestra como **atrasado** arriba de todo: pasa
cuando el teléfono estuvo apagado, y nunca se descarta en silencio.

## Decisiones que vale la pena conocer

**Zonas horarias.** Guardamos dos cosas: la *hora de pared* que elegiste (`localAt`, ej.
`"2026-09-14T09:00"`) y el instante UTC calculado (`scheduledAt`). La fuente de verdad es la
primera, porque la intención es "el lunes a las 9", no un instante fijo. Al arrancar, la app
recalcula el UTC desde la hora de pared: si cambian las reglas del huso, el mensaje sigue
saliendo a las 9 hora local y se reagenda la notificación.

**Números argentinos.** WhatsApp identifica a los celulares como `+54 9 <área> <número>`,
pero la gente los escribe sin el 9 (y a veces con un 15 en el medio). Cuando parseamos un
`+54` sin el 9 y con largo de fijo, asumimos celular, agregamos el 9 y lo mostramos en
pantalla para que se pueda corregir.

**Una sola notificación por mensaje.** Guardamos el `notificationId` en la fila. Reprogramar
cancela la vieja antes de agendar la nueva; sin eso llegarían dos avisos.

**Permisos.** Se piden al final de la explicación del primer uso, cuando ya se entiende para
qué sirven, y si se saltea esa pantalla, al programar el primer mensaje. Si están denegados,
la lista muestra un aviso persistente, porque sin ellos la app no cumple su función.

**Puntualidad en Android.** Este es el riesgo más serio de la app y merece explicación.
Android puede demorar las notificaciones programadas para ahorrar batería, y encima Xiaomi,
Samsung, Huawei y Oppo tienen gestores propios que matan apps en segundo plano con criterios
no documentados. El resultado: el aviso de las 9:00 llega 9:40, o no llega. En un Pixel
enchufado no se nota nunca.

Desde JavaScript no se puede consultar si el sistema va a respetar una alarma exacta. Así
que en vez de preguntar, **medimos**: cada vez que un aviso suena, `reliability.ts` compara
la hora real con la que correspondía. Si los retrasos se repiten (o hay uno grave), la app lo
dice en la lista y ofrece los dos ajustes del sistema que lo arreglan — alarmas exactas y
optimización de batería — con `expo-intent-launcher`, que lleva directo a la pantalla
correcta.

Para la exención de batería abrimos la **lista general** del sistema en vez de pedir la
exención directa: el pedido directo necesita un permiso que Google Play restringe, y esta
pantalla no requiere ninguno.

## Privacidad

Todo vive en el dispositivo: SQLite local, sin backend, sin cuenta, sin analytics. Ni el
texto de los mensajes ni los contactos salen del teléfono. Funciona sin internet.

El texto completo está en [`PRIVACY.md`](PRIVACY.md) y también dentro de la app, en
Ajustes → Privacidad. Las tiendas piden una **URL pública**: publicar ese archivo con GitHub
Pages alcanza.

## Checklist para publicar

Lo que todavía falta antes de que la app llegue a gente que no seas vos:

- [x] Política de privacidad (`PRIVACY.md`, falta publicarla como URL)
- [x] Pantalla de primer uso que aclara que el envío lo confirma la usuaria
- [x] Manejo de la puntualidad de los avisos en Android
- [ ] **Icono y splash screen** — hoy no hay ninguno; ambas tiendas los exigen
- [ ] **Probar en un teléfono que no sea Pixel** — Xiaomi o Samsung, donde aparecen los
      problemas de puntualidad reales
- [ ] **Verificar la política de Google Play sobre alarmas exactas** antes de publicar:
      `SCHEDULE_EXACT_ALARM` requiere justificación y conviene confirmar que una app de
      recordatorios califica
- [ ] **Testing cerrado** — Google exige a las cuentas personales nuevas 12 testers durante
      14 días corridos antes de poder publicar
- [ ] Listado de tienda: capturas, descripción y una línea explícita de "no afiliada a
      WhatsApp ni a Meta" 

## Funciones de v2 ya implementadas

- **Mensajes recurrentes** — diarios, semanales, mensuales o anuales. Cada salida queda
  archivada en el historial y el mensaje vivo avanza a la próxima fecha. Si el teléfono
  estuvo apagado varias semanas no se arrastra una cola de repeticiones vencidas: se
  retoma en la siguiente que corresponde. Saltear una repetición no corta la serie.
- **Plantillas con variables** `{nombre}` — se guardan desde la pantalla de mensaje nuevo y
  se administran en Ajustes → Plantillas. Una variable sin completar queda visible en el
  texto en vez de dejar un hueco silencioso, y avisamos antes de programar.
- **Mismo texto a varios destinatarios** — crea un mensaje individual por persona, con su
  propia notificación. No es una difusión: editar o cancelar uno no toca a los demás.
- **Ventana de horario permitido** — configurable en Ajustes. No bloquea: si elegís una hora
  fuera de la franja, propone la siguiente válida y vos decidís.
- **Backup** — exporta un archivo JSON con mensajes y plantillas por el share sheet del
  sistema, y lo vuelve a importar. El archivo se valida entero antes de tocar la base, así
  un backup corrupto falla con un mensaje claro en vez de dejar datos a medio importar.
  Los adjuntos viajan como ficha (nombre, tipo, peso) y no como archivo: al importar, los
  que sigan estando en el teléfono se conservan y de los que no, se avisa cuántos son.
- **Archivo adjunto** — una foto, un PDF, lo que sea. Se copia a una carpeta de la app
  apenas se elige, porque el permiso de lectura que da el selector del sistema se vence y
  el archivo original puede desaparecer antes de la hora del mensaje. Las copias que ya no
  menciona ningún mensaje se borran en el arranque siguiente. Ver abajo qué cede esto.

## Qué sigue sin estar (y por qué)

- **Mandar un adjunto de un solo toque.** Se puede adjuntar, pero no por el camino directo.
  El deep link de WhatsApp (`whatsapp://send`, `wa.me`) solo acepta un número y un texto, y
  entregar un archivo a otra app exige un `content://` con permiso de lectura. En Expo eso
  lo hace `expo-sharing`, que siempre abre el menú del sistema: no acepta un paquete
  concreto —así que con adjunto no se puede elegir entre WhatsApp y WhatsApp Business desde
  la app— y su intent lleva el archivo pero no el texto. `expo-intent-launcher`, que sí
  acepta un paquete, no sirve: pasa los extras por un Bundle de strings y `EXTRA_STREAM`
  tiene que ser un `Uri` parcelable. Por eso, con archivo: se abre la lista de chats de
  WhatsApp y el texto queda en el portapapeles para pegarlo de epígrafe. En iPhone el texto
  y el archivo van juntos por la hoja de compartir y WhatsApp suele tomarlo de epígrafe,
  pero igual se copia porque "suele" no es "siempre".
- **Elegir la foto desde la galería.** El selector es el de documentos, no el de fotos. En
  Android el de documentos entra igual a las fotos y no pide ningún permiso; el de la
  galería obliga a declarar `READ_MEDIA_IMAGES`, que en Google Play arrastra un formulario
  de justificación. En iPhone, en cambio, esto significa que hay que ir por Archivos: el
  carrete no aparece. El día que haga falta, la salida es `expo-image-picker` y el
  formulario.
- **Sincronización entre dispositivos.** Necesita un servidor donde guardar los mensajes, y
  eso choca de frente con la decisión de que el contenido no salga del teléfono. El backup
  manual cubre el caso de cambiar de celular sin romper esa promesa. Si en algún momento la
  sincronización vale la pena, habría que hablar de cifrado de punta a punta primero.
