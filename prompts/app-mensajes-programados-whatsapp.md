# Prompt: App de mensajes programados para WhatsApp

> Copiá todo lo que sigue (desde "CONTEXTO") y pegalo en Claude, Lovable, v0, Cursor o la
> herramienta que uses para generar la app.

---

## CONTEXTO

Quiero que construyas una **app de celular** (iOS y Android) que me permita **escribir mensajes
ahora y programar su envío por WhatsApp para un día y horario elegidos**.

El problema que resuelve: muchas veces quiero responder algo en el momento en que lo pienso,
pero no es el día ni la hora conveniente para que le llegue a la otra persona (es tarde, es
fin de semana, es un mensaje de trabajo un domingo, es un saludo que corresponde mañana).
Hoy la alternativa es acordarse después — y uno se olvida.

La idea es poder dejar **todos los mensajes armados y programados**, y que aparezcan solos
en el día y hora que elegí, listos para salir.

## USUARIA Y CONTEXTO DE USO

- Uso personal y profesional liviano (no es una herramienta de marketing masivo ni de envíos en lote).
- Volumen realista: entre 5 y 50 mensajes programados vivos al mismo tiempo.
- Mobile-first. La mayor parte del uso es desde el celular, en momentos sueltos.
- Idioma de la interfaz: español rioplatense, tono cercano y directo.

## CÓMO FUNCIONA EL ENVÍO — LEELO ANTES DE DISEÑAR

La app funciona con el modelo **"listo para enviar"**:

1. Guardo el mensaje y el momento elegido.
2. Llegada la hora, la app dispara una **notificación push local**, incluso con la app cerrada.
3. Al tocar la notificación, se abre **WhatsApp directo en el chat de esa persona, con el texto
   ya cargado en el campo de escritura** (vía deep link `whatsapp://send?phone=<e164>&text=<texto>`,
   con fallback a `https://wa.me/<numero>?text=<texto>`).
4. Solo toco "enviar". Un toque.

Este es el único camino que tenés que implementar.

**Por qué, para que no te desvíes:** WhatsApp no permite que una app de terceros envíe mensajes
automáticamente desde una cuenta personal. Las librerías no oficiales que automatizan WhatsApp Web
(`whatsapp-web.js`, `Baileys` y similares) violan los términos de servicio y llevan a que baneen
el número. La única alternativa con envío realmente automático es la **WhatsApp Cloud API** oficial
de Meta, que exige un número registrado como WhatsApp Business y, pasadas 24 h desde el último
mensaje del contacto, solo admite plantillas aprobadas por Meta — no sirve para uso personal.
Así que: deep link con confirmación en un toque, y nada más.

Sé honesto en la interfaz: en ningún momento le digas a la usuaria que el mensaje "se envió solo".
Lo que la app promete es "te lo dejo listo en el momento justo", y eso es exactamente lo que hace.
Que el copy de toda la app refleje esa promesa.

## FUNCIONALIDADES — MVP

1. **Crear mensaje programado**
   - Elegir destinatario: desde los contactos del teléfono, o escribiendo el número a mano
     (con selector de código de país, default Argentina +54).
   - Escribir el texto del mensaje, multilínea, sin límite práctico de caracteres.
   - Elegir fecha y hora de envío.
   - Atajos rápidos de horario: "Mañana a las 9", "Lunes a las 9", "En 2 horas", "Esta tarde
     a las 18". Que cubran el 80% de los casos sin abrir el date picker.
   - Guardar.

2. **Lista de programados**
   - Vista principal: todos los mensajes pendientes ordenados por fecha de envío ascendente.
   - Agrupados por día con encabezados legibles: "Hoy", "Mañana", "Viernes 19", etc.
   - Cada ítem muestra: nombre o número del destinatario, hora, y las primeras 2 líneas del texto.
   - Contador arriba: "7 mensajes programados".

3. **Editar / reprogramar / duplicar / cancelar**
   - Editar el texto o el destinatario de un mensaje pendiente.
   - Reprogramar: cambiar día y hora, con atajos "+1 hora", "+1 día", "próximo lunes".
   - Duplicar un mensaje para mandárselo a otra persona sin reescribirlo.
   - Cancelar (borrar) con confirmación y opción de deshacer por unos segundos.

4. **Disparo a la hora elegida**
   - Notificación push local a la hora exacta, con la app cerrada o el celular bloqueado.
   - La notificación muestra a quién va dirigido y el principio del texto.
   - Acción principal: abrir WhatsApp con el mensaje precargado.
   - Acción secundaria: "Posponer 1 hora".
   - Al volver a la app después de abrir WhatsApp, preguntar "¿Lo enviaste?" para marcar el
     estado. Una sola vez, sin insistir.

5. **Historial**
   - Mensajes ya enviados (o marcados como enviados), con fecha real de envío.
   - Poder reenviar uno viejo con un toque (lo copia como nuevo programado).

6. **Borradores**
   - Guardar un mensaje escrito **sin** fecha todavía. Queda en una sección "Sin programar"
     hasta que le pongas día y hora. Esto es clave: a veces uno quiere sacarse el texto de
     la cabeza antes de decidir cuándo mandarlo.

## FUNCIONALIDADES — v2 (dejá el modelo de datos preparado, no las implementes ahora)

- Mensajes recurrentes (todos los lunes, todos los meses, cada cumpleaños).
- Plantillas reutilizables con variables tipo `{nombre}`.
- Mismo texto a varios destinatarios (cada uno como mensaje individual, nunca como difusión masiva).
- Ventana de "horario permitido": nunca programar fuera de, por ejemplo, 9 a 21 h, y si elegís
  una hora fuera de esa franja que te sugiera la siguiente hora válida.
- Adjuntar una imagen (ojo: el deep link de WhatsApp no soporta adjuntos, habría que resolverlo
  con el share sheet del sistema).
- Backup y sincronización entre dispositivos.

## MODELO DE DATOS

```
ScheduledMessage
  id              uuid
  contactName     string?        // nombre mostrado, si vino de la agenda
  phoneE164       string         // formato +5491112345678, siempre normalizado
  body            text
  scheduledAt     datetime       // guardado en UTC
  timezone        string         // IANA, ej "America/Argentina/Buenos_Aires"
  status          enum: draft | scheduled | fired | sent | skipped
  createdAt       datetime
  firedAt         datetime?      // cuándo sonó la notificación
  sentAt          datetime?      // cuándo se confirmó el envío
  recurrenceRule  string?        // RRULE, null en el MVP
  notes           string?        // nota privada para una misma, no se envía
```

**Estados y transiciones:**
`draft` → (se le asigna fecha) → `scheduled` → (llegó la hora, sonó la notificación) → `fired`
→ (abrió WhatsApp y confirmó) → `sent`.
Desde `fired`, si descarta puede ir a `skipped`, o volver a `scheduled` al posponer.

## PANTALLAS

1. **Inicio / Programados** — la lista agrupada por día + botón flotante "＋ Nuevo mensaje".
2. **Nuevo / Editar mensaje** — destinatario, textarea, selector de fecha y hora con atajos,
   preview de cómo se va a ver, botón "Programar".
3. **Detalle del mensaje** — texto completo, cuándo sale, y acciones: enviar ahora, reprogramar,
   duplicar, cancelar.
4. **Historial** — enviados y omitidos.
5. **Ajustes** — zona horaria, permisos de notificaciones, formato de fecha.

## DETALLES DE UX QUE IMPORTAN

- **Zonas horarias y horario de verano:** guardá siempre en UTC junto con la zona IANA.
  Si el mensaje se programó para "el lunes a las 9" y en el medio cambia el huso, tiene que
  seguir saliendo a las 9 hora local.
- **Permisos de notificaciones:** pedilos en el momento en que la usuaria programa su primer
  mensaje, con una explicación de por qué hacen falta — no en el primer arranque a quemarropa.
  Si están denegados, mostrá un aviso claro y persistente en la lista, porque sin ellos la app
  no cumple su única función.
- **Si el celular estuvo apagado** y la hora ya pasó: mostrá el mensaje como "atrasado" bien
  visible arriba de todo, no lo escondas ni lo descartes en silencio.
- **Números de teléfono:** normalizá siempre a E.164. Los números argentinos son un caso
  clásico de error, contemplá el 9 después del +54 para celulares.
- **Nada de fricción para escribir:** que crear un mensaje sea abrir la app, tocar "＋",
  escribir y elegir "mañana 9". Tres toques.
- **Vista previa fiel:** que el preview se vea como una burbuja de chat real, para poder
  releer el tono antes de comprometerse.

## STACK SUGERIDO

- **React Native + Expo** (una sola base de código para iOS y Android, y `expo-notifications`
  resuelve las notificaciones locales programadas, que son el corazón de la app).
- **SQLite local** (`expo-sqlite` o Drizzle). Los datos viven en el dispositivo: no hace falta
  backend para el MVP y es mejor para la privacidad.
- **TypeScript** en todo el proyecto, con tipos estrictos.
- `expo-contacts` para la agenda, `expo-linking` para abrir WhatsApp, `libphonenumber-js`
  para normalizar números, `date-fns` + `date-fns-tz` para fechas y husos.

Si preferís proponer otro stack, justificá el cambio en una línea antes de arrancar.

## PRIVACIDAD

El contenido de los mensajes y los contactos **no salen del dispositivo**. Sin backend, sin
analytics de terceros, sin telemetría sobre el texto. Dejalo escrito en la pantalla de Ajustes.

## CRITERIOS DE ACEPTACIÓN

- [ ] Puedo crear un mensaje para un contacto y programarlo para mañana a las 9.
- [ ] A las 9 del día siguiente, con la app cerrada, me llega la notificación.
- [ ] Al tocar la notificación se abre WhatsApp en el chat correcto, con el texto ya escrito.
- [ ] Puedo editar el texto de un mensaje que todavía no salió.
- [ ] Puedo reprogramar un mensaje y la notificación vieja se cancela (no llegan dos).
- [ ] Puedo cancelar un mensaje y deshacer la cancelación.
- [ ] Puedo guardar un mensaje sin fecha y ponerle fecha después.
- [ ] La lista muestra los pendientes agrupados por día, del más próximo al más lejano.
- [ ] Si el teléfono estuvo apagado, al abrir la app veo los atrasados marcados como tales.
- [ ] Todo funciona sin conexión a internet.

## QUÉ NO HACER

- No automatices WhatsApp Web ni uses librerías no oficiales (`whatsapp-web.js`, `Baileys`
  y similares): es camino directo al baneo del número.
- No implementes la Cloud API de Meta: no es para este caso de uso.
- No prometas envío automático en la UI.
- No armes funciones de envío masivo ni de difusión a listas grandes.
- No pidas login ni creación de cuenta.
- No subas el contenido de los mensajes a ningún servidor.

## ENTREGABLE

Arrancá por el flujo completo de un mensaje: crear → programar → notificar → abrir WhatsApp →
marcar como enviado. Ese recorrido tiene que funcionar de punta a punta antes de sumar
historial, borradores o ajustes. Cuando lo tengas, mostrame cómo probarlo.
