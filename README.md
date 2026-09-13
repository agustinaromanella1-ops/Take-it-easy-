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

## Correr el proyecto

```bash
npm install
npx expo start
```

> **Importante:** las notificaciones locales programadas no son confiables en Expo Go.
> Para probar el flujo completo hace falta un *development build*:
>
> ```bash
> npx expo run:android    # o npx expo run:ios
> ```
>
> En Android 13+ el permiso de notificaciones se pide en tiempo de ejecución (lo hace la
> app cuando programás tu primer mensaje).

Verificaciones:

```bash
npm run typecheck   # tsc --noEmit
npm test            # 38 tests sobre la lógica de dominio
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
    whatsapp.ts  armado de los deep links
  db/          SQLite local con migraciones versionadas
  notifications/  agendado y cancelación de avisos locales
  state/       MessagesContext: une base, notificaciones y ciclo de vida
  components/  UI reutilizable
  screens/     Programados, Nuevo/Editar, Detalle, Historial, Ajustes
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

## Qué falta (v2)

El modelo de datos ya tiene lugar para esto, pero no está implementado:

- Mensajes recurrentes (`recurrenceRule` está en la tabla, siempre en `null`).
- Plantillas con variables tipo `{nombre}`.
- Mismo texto a varios destinatarios, cada uno como mensaje individual.
- Ventana de horario permitido (no programar fuera de 9–21 h).
- Adjuntar imágenes (el deep link de WhatsApp no las soporta: habría que ir por el share sheet).
- Backup y sincronización entre dispositivos.
