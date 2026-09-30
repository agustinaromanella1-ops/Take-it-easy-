# Política de privacidad — Listo para enviar

**Última actualización:** 30 de septiembre de 2026

## Resumen

Esta app no recolecta, transmite ni almacena tus datos en ningún servidor. Todo lo que
escribís queda en tu teléfono. No hay cuenta, no hay registro, no hay analytics.

La app hace **una sola** conexión a internet, y es opcional: consultar si hay una versión
nueva para descargar. Está explicada abajo.

## Qué datos maneja la app y dónde quedan

Todo lo que sigue se guarda **únicamente en el almacenamiento local de tu dispositivo**, en
una base de datos SQLite privada de la app:

- **El texto de tus mensajes programados.** Nunca sale del teléfono hasta que vos mismo lo
  enviás por WhatsApp.
- **Los números de teléfono y nombres de los destinatarios** que elegís.
- **Las fechas y horas** que programás.
- **Tus plantillas** y tus preferencias (zona horaria, horario permitido).
- **Marcas de tiempo de entrega de las notificaciones**, que la app usa para detectar si los
  avisos están llegando tarde y avisarte. Son solo fechas: no incluyen contenido.
- **Los archivos que adjuntás a un mensaje.** Cuando adjuntás una foto o un documento, la
  app se guarda una copia en su propia carpeta privada, para que el archivo siga estando el
  día del mensaje aunque para entonces lo hayas movido o borrado. Esa copia no sale del
  teléfono hasta que vos mismo mandás el mensaje por WhatsApp, y se borra sola cuando ya no
  queda ningún mensaje que la use.

Cuando desinstalás la app, todo esto se borra con ella.

## Acceso a tus contactos

Si le das permiso, la app puede abrir el selector de contactos del sistema para que elijas a
quién mandarle un mensaje. Solo se guarda el nombre y el número de la persona que elegiste,
y solo en tu teléfono. La app no lee tu agenda completa, no la copia ni la transmite a
ningún lado. Podés no dar el permiso y escribir los números a mano: la app funciona igual.

## La única conexión a internet: buscar actualizaciones

La app no se distribuye por una tienda, así que para avisarte de una versión nueva consulta
la página pública de GitHub donde está publicado el archivo. Es un pedido de lectura
(`GET`) a `api.github.com`, y **no lleva nada tuyo**: ni tus mensajes, ni tus contactos, ni
un identificador del teléfono. Lo único que compara es la fecha del archivo publicado
contra la fecha en que se compiló tu app.

Se hace una vez al abrir la app, y de nuevo solo si tocás "Buscar actualizaciones" en
Ajustes. Si no hay internet o falla, la app no muestra ningún error y sigue funcionando
igual: todo el resto anda sin conexión.

Como cualquier pedido a un servidor, GitHub ve la dirección IP desde la que se hace, igual
que si abrieras esa página en el navegador. No podemos evitar eso y por eso lo decimos.

## Notificaciones

La app usa notificaciones **locales**: las programa el sistema operativo de tu propio
teléfono. No hay notificaciones push, no hay servidor que las envíe, y ningún token de
notificación sale del dispositivo.

## Relación con WhatsApp

Esta app **no es oficial ni está asociada a WhatsApp ni a Meta**. No se conecta a los
servidores de WhatsApp, no accede a tus conversaciones y no envía mensajes por vos. Lo único
que hace es abrir WhatsApp con un enlace público y documentado (`wa.me`), con el texto ya
cargado, para que vos toques enviar. Lo que pase dentro de WhatsApp se rige por la política
de privacidad de WhatsApp.

## Backups

La función de backup genera un archivo con tus mensajes y plantillas y te deja elegir dónde
guardarlo con el menú de compartir del sistema. Ese archivo no se sube a ningún lado: el
destino lo elegís vos. Si lo guardás en un servicio en la nube, pasa a regirse por las
condiciones de ese servicio.

El backup **no incluye los archivos adjuntos**, solo su nombre, tipo y peso: meter fotos y
PDFs adentro volvería el archivo de cientos de megas. Al importar en el mismo teléfono, los
adjuntos que sigan estando se conservan; viniendo de otro, la app te dice cuántos mensajes
se quedaron sin su archivo para que los vuelvas a adjuntar.

## Terceros

La app no incluye SDKs de analytics, publicidad, seguimiento ni reporte de errores. El
único servidor con el que habla es GitHub, para la consulta de versión descrita arriba, y
en esa consulta no viaja ningún dato tuyo.

## Permisos que pide la app y para qué

| Permiso | Para qué |
|---|---|
| Notificaciones | Avisarte cuando llega la hora de un mensaje. Sin esto la app no cumple su función. |
| Contactos (opcional) | Elegir destinatarios de tu agenda. Podés negarlo y escribir los números a mano. |
| Alarmas exactas (Android) | Que el aviso suene a la hora exacta y no demorado por el ahorro de batería. |

## Menores

La app no está dirigida a menores de 13 años y no recolecta datos de nadie,
independientemente de su edad.

## Cambios

Si esta política cambia, la versión actualizada va a estar publicada en este mismo lugar con
una nueva fecha.

## Contacto

Para cualquier consulta sobre privacidad, escribí a través del repositorio del proyecto:
https://github.com/agustinaromanella1-ops/Take-it-easy-
