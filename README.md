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
npm test            # 71 tests sobre la lógica de dominio
```

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
    whatsapp.ts  armado de los deep links
  db/          SQLite local con migraciones versionadas
  notifications/  agendado y cancelación de avisos locales
  state/       MessagesContext: une base, notificaciones y ciclo de vida
  components/  UI reutilizable
  screens/     Programados, Nuevo/Editar, Detalle, Historial, Plantillas, Ajustes
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

**Permisos.** Se piden recién cuando programás tu primer mensaje, no en el arranque: en ese
momento el pedido tiene un porqué evidente. Si están denegados, la lista muestra un aviso
persistente, porque sin ellos la app no cumple su función.

## Privacidad

Todo vive en el dispositivo: SQLite local, sin backend, sin cuenta, sin analytics. Ni el
texto de los mensajes ni los contactos salen del teléfono. Funciona sin internet.

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

## Qué sigue sin estar (y por qué)

- **Adjuntar imágenes.** El deep link de WhatsApp solo acepta texto: no hay forma de abrir
  un chat con una imagen precargada. Lo más cerca que se puede llegar es el share sheet del
  sistema (`expo-sharing`), que deja elegir el chat pero no permite adjuntar la imagen y el
  texto juntos ni volver a la app para confirmar. Sería una experiencia distinta a la del
  resto, así que preferimos no simularla.
- **Sincronización entre dispositivos.** Necesita un servidor donde guardar los mensajes, y
  eso choca de frente con la decisión de que el contenido no salga del teléfono. El backup
  manual cubre el caso de cambiar de celular sin romper esa promesa. Si en algún momento la
  sincronización vale la pena, habría que hablar de cifrado de punta a punta primero.
