# Take It Easy — Diseño previo

Cómo se construye lo que describe `take-it-easy-especificacion-v2.md`:
pantallas, modelo de datos, filtro de anonimización, backend y riesgos.
Este documento define decisiones estructurales, no detalles de
implementación que se resuelven mejor escribiendo el código.

Las reglas innegociables del proyecto son la restricción de partida de todo
lo que sigue. Cuando una decisión de diseño choque con una regla, la regla
gana.

---

## 1. Pantallas

`prototipos/` contiene cuatro pantallas en HTML —Hoy, Asistencia, Pegar la
lista y Ficha de alumno—, **aprobadas**. Son la referencia visual y de
interacción para todo lo demás. No son código a reutilizar.

Cuando una descripción de esta sección y un prototipo no coincidan, gana el
prototipo, y lo que hay que corregir es este documento.

Con una excepción, porque un prototipo no puede prometer lo que no existe:
donde muestra una pantalla que todavía no está construida —una pestaña de
la barra inferior, por ejemplo— eso es la forma a la que hay que llegar, no
un botón para poner ahora. Una pestaña que no lleva a ningún lado es peor
que una pestaña que falta.

### 1.1 Navegación

Navegación plana, sin menús anidados. El docente entra a la app entre dos
clases con el teléfono en una mano: cada pantalla de uso frecuente está a
un toque desde el arranque.

- **Hoy** es la pantalla de arranque.
- Desde Hoy se llega en un toque a la asistencia de cualquier clase del día.
- El botón atrás de Android **guarda y vuelve**, nunca descarta. No hay
  pantalla en la que salir sin guardar sea el comportamiento por defecto.
- Donde todavía no hay nada que guardar —un formulario a medio llenar, una
  lista pegada sin confirmar— lo escrito queda como **borrador en
  IndexedDB**, con la clave de esa pantalla, y vuelve al entrar de nuevo.
  En memoria no alcanza: Android mata la app en segundo plano, y ahí es
  donde de verdad se pierde lo escrito. El borrador se borra al confirmar,
  y un borrador vacío no se guarda.

### 1.2 Inventario de pantallas

| Pantalla | Acción primaria única |
|---|---|
| Hoy | Tomar asistencia de la clase que sigue |
| Asistencia | Marcar el estado de cada alumno |
| Cursos y materias | Crear una materia |
| Alumnos de una materia | Agregar alumnos |
| Pegar lista de alumnos | Revisar el parseo y confirmar el alta |
| Ficha de alumno | Anotar una observación |
| Calificaciones de una evaluación | Cargar notas |
| Agenda | Agregar una entrada |
| Redactar (observación, mensaje, entrada de agenda) | Guardar |
| Revisión de envío al asistente | Enviar |
| Ajustes | — |

### 1.3 Reglas de interacción que atraviesan todas las pantallas

- **Una sola acción primaria por pantalla.** Todo lo demás es secundario y
  se ve como secundario.
- **Deshacer en lugar de confirmar.** Cero diálogos modales durante la
  clase: marcar, borrar y cambiar un estado son acciones inmediatas con
  una barra de deshacer que dura unos segundos.
- **Ningún estado se lee sólo por color.** Presente, ausente, tarde y la
  marca de justificada se distinguen en palabras, no en tono de pastel.
- **Tono calmo.** Sin signos de exclamación, sin urgencia, sin apuro.
  Ningún texto de la app califica a un alumno: describe hechos.
- **Los estados vacíos invitan a hacer algo**, no piden disculpas. Un
  curso sin alumnos ofrece pegar la lista; un día sin clases ofrece cargar
  el horario.

### 1.4 Identidad visual aplicada

- Cada materia toma uno de los seis pastel de la paleta, elegido al
  crearla. El pastel nunca lleva texto de su mismo tono: siempre el par
  oscuro correspondiente.
- **Verde salvia queda reservado al estado "presente".** No se usa en
  botones, fondos ni como color de materia.
- Primario `#7B5EA7` con texto blanco, una sola instancia visible por
  pantalla (la acción primaria).
- Fondo `#FFF9F5`, superficies `#FFFFFF`, texto `#2E2A45` y `#6E6880`.
  Nunca negro puro.
- Nunito para toda la interfaz. Baloo 2 sólo en el logo.

### 1.5 Texto de las notificaciones

Una notificación se lee en la pantalla bloqueada, a la vista de cualquiera
que esté cerca. De ahí las dos reglas que fijan su forma.

**No se muestra texto escrito por el docente.** Ni el título de la entrada
de agenda, ni el nombre de la evaluación. Una entrada que dice "hablar con
Delfina sobre el trabajo" es perfectamente razonable de escribir, y
mostrarla en la pantalla bloqueada publica el nombre de una alumna. El
cuerpo de la notificación es fijo; el contenido se ve al abrir la app.

**No se prometen horas.** Los recordatorios son notificaciones inexactas
(decisión tomada del proyecto): pueden llegar más tarde de lo programado.
Un texto que diga "en diez minutos" va a estar mal seguido.

| Caso | Título | Cuerpo |
|---|---|---|
| Nota para una clase | `Lengua · 3.º B` | Tenés una nota para esta clase. |
| Evaluación anotada | `Historia · 4.º A` | Hoy tenés una evaluación anotada. |
| Sin materia asociada | `Take It Easy` | Tenés una nota para hoy. |

La materia y el curso sí van en el título: no son datos de un alumno, y sin
ellos la notificación no dice nada útil.

Tono calmo también acá: sin signos de exclamación, sin "¡no te olvides!",
sin contador de pendientes.

---

## 2. Modelo de datos

IndexedDB es la fuente de verdad (regla innegociable 7). No hay
sincronización ni copia remota de estos datos.

### 2.1 Entidades

```
Escuela         id, nombre
Materia         id, escuelaId, nombre, anio, division, colorPastel,
                escalaPorDefecto, archivada
BloqueHorario   id, materiaId, diaSemana (1 lunes … 7 domingo), horaInicio, horaFin
Alumno          id, nombre, apellido, creadoEn
Inscripcion     id, alumnoId, materiaId, estado (activa|baja), desde, hasta
ClaseSesion     id, materiaId, fecha, bloqueHorarioId, tema
RegistroAsistencia  id, claseSesionId, alumnoId, estado, justificada,
                registradoEn
Evaluacion      id, materiaId, nombre, fecha, tipo, escala
Calificacion    id, evaluacionId, alumnoId, valor, registradoEn
Observacion     id, ambito (alumno|materia), alumnoId, materiaId,
                fecha, texto, capa, creadoEn
Plantilla       id, texto, ambito (individual|grupal)
EntradaAgenda   id, materiaId, fecha, titulo, detalle
Recordatorio    id, entradaAgendaId, fechaHoraLocal, idNotificacion, estado
```

`Alumno` guarda nombre y apellido, y nada más. No hay campo de DNI,
domicilio, fecha de nacimiento, foto, teléfono ni contacto de familia, y no
se agrega ninguno después (regla innegociable 6). Tampoco hay campo de
salud, diagnóstico ni sospecha diagnóstica en ninguna entidad, y no existe
el campo "libre" que termina usándose para eso (regla innegociable 5).

### 2.2 Alumno cuelga de Inscripcion, no de Materia

Un alumno existe **una sola vez** en la base. La relación con las materias
pasa siempre por `Inscripcion`. Un docente que tiene al mismo chico en dos
materias lo carga una vez y lo inscribe dos veces; su historial es uno
solo.

Dar de baja una inscripción cambia su `estado`, no borra registros: la
asistencia y las notas ya cargadas siguen ahí.

Índice único: `[alumnoId + materiaId]`.

### 2.3 Unicidad de los pares

Dos índices únicos que no son negociables:

- `RegistroAsistencia`: `[claseSesionId + alumnoId]`
- `Calificacion`: `[evaluacionId + alumnoId]`

Sin ellos, un doble toque duplica el registro y el promedio miente. La
capa de datos expone estas escrituras como **upsert por par**: escribir dos
veces actualiza, nunca inserta un segundo registro. La interfaz no tiene
que defenderse del doble toque, porque no es su responsabilidad.

`ClaseSesion` también es única por `[materiaId + fecha + bloqueHorarioId]`:
la misma materia puede dictarse dos veces el mismo día en bloques
distintos, pero no dos veces en el mismo bloque.

### 2.4 Archivar una materia

Una materia se **archiva**, no se borra. `Materia.archivada` la saca de la
lista y de "Hoy", y no toca nada de lo que cuelga: los alumnos siguen
inscriptos, la asistencia tomada sigue tomada, las notas siguen puestas.

Un curso que termina no deja de haber existido. Borrarlo se llevaría
puesto el registro de un año entero de asistencia, y sería la única acción
de la app sin vuelta atrás.

Como es reversible, no se pregunta antes: las archivadas quedan listadas
aparte con su botón de recuperar, que es el deshacer, disponible siempre y
no durante unos segundos.

### 2.5 Capas de la observación

`Observacion.capa` tiene dos valores: `privada` y `compartible`.

**Toda observación nueva nace en `privada`** (regla innegociable 4). La
capa de datos no acepta una escritura sin capa y no toma otro valor por
defecto; el formulario no preselecciona `compartible` en ningún caso.
Cambiar de capa es una acción explícita y posterior del docente.

### 2.6 Plantillas: el bloqueo del nombre

Una `Plantilla` de ámbito `grupal` no puede contener un nombre de alumno
(regla innegociable 3). La validación vive en la **capa de datos**: al
guardar una plantilla grupal, y al aplicarla a más de un alumno, el texto
se contrasta contra el índice de nombres conocidos (sección 3.2). Si hay
coincidencia, la operación se rechaza con un error. No es un cartel en la
interfaz que el docente pueda ignorar: es una escritura que no ocurre.

### 2.7 Fechas

Las fechas de calendario (`ClaseSesion.fecha`, `Evaluacion.fecha`,
`Observacion.fecha`, `EntradaAgenda.fecha`, `Inscripcion.desde/hasta`) se
guardan como **texto local**: `2026-09-09`. Nunca como marca de tiempo UTC,
nunca vía `toISOString()`. Después de las 21 h en Argentina, el UTC ya es
el día siguiente y "hoy" se rompe.

Las marcas de auditoría (`creadoEn`, `registradoEn`) sí son instantes y se
guardan como epoch en milisegundos: son momentos, no días de calendario.
La distinción es deliberada y conviene mantenerla explícita en los nombres.

`Recordatorio.fechaHoraLocal` es fecha local más hora local, sin zona: el
recordatorio suena a la hora del teléfono.

`BloqueHorario.diaSemana` va de **1 lunes a 7 domingo**, como ISO 8601, y no
como `getDay()` de JavaScript, que cuenta el domingo como 0 y arranca la
semana ahí. La conversión se hace en un solo lugar y tiene test: es un
corrimiento de un día que no se nota hasta que alguien mira un domingo.

**Mirar Hoy no crea clases.** La `ClaseSesion` se crea recién al entrar a
tomar asistencia. Si la creara la pantalla, quedarían clases dictadas en la
base para días en los que nunca se dio clase, y el historial mentiría.

### 2.8 Estados de asistencia

Tres estados, y una marca aparte:

```
estado        presente | ausente | tarde
justificada   true | false
```

**"Justificada" no es un cuarto estado, es una propiedad del registro.** Una
llegada tarde puede estar justificada igual que una ausencia; como estado
suelto habría que elegir entre "tarde" y "justificada", y se perdería la
mitad de la información. Como marca, las dos cosas conviven.

`justificada` sólo tiene sentido sobre `ausente` y `tarde`. La capa de datos
la ignora sobre `presente` en vez de rechazar la escritura: no es un error
del docente, es un toque de más.

En la interfaz son tres botones por fila —tres entran cómodos en el ancho de
un teléfono, cinco no— y la marca es un segundo toque sobre el estado ya
elegido. Se lee como texto: "Ausente" y "Ausente justificada" son distintas
en palabras, no en tono de rosa.

**Retiro anticipado no es un estado.** En una clase de 40 a 80 minutos,
quien se retira antes estuvo presente; si importa por qué, es una
observación. Un estado más en la pantalla que se usa todos los días cuesta
más de lo que aporta.

### 2.9 Escalas de calificación

Cada materia define su escala por defecto y cada evaluación la hereda,
pudiendo cambiarla: un trabajo práctico conceptual y un parcial numérico
conviven en la misma materia.

```
Escala   tipo (numerica|conceptual)
         numerica:    min, max, decimales
         conceptual:  etiquetas [{ id, texto }]
```

En las escalas conceptuales, `Calificacion.valor` guarda el **id** de la
etiqueta, no su texto. Así, renombrar "MB" a "Muy bueno" no deja huérfanas
las notas ya cargadas.

**El promedio se calcula sólo sobre evaluaciones de escala numérica**, y la
pantalla dice cuántas quedaron afuera. Promediar etiquetas conceptuales
—convirtiéndolas a 1, 2, 3— es inventar una distancia entre ellas que nadie
definió, y es la forma más silenciosa de que el promedio mienta. En una
materia con escala conceptual no hay promedio: hay distribución, cuántas de
cada etiqueta.

### 2.10 Exportación

IndexedDB puede ser desalojada por el sistema, y un teléfono se pierde o se
rompe. Como no hay backend con datos, la única red de seguridad es una
**exportación manual a archivo** desde Ajustes, con su importación
correspondiente. Es parte del alcance, no un extra.

El formato es **un archivo JSON con versión de esquema**:

```
{ "version": 1, "exportadoEn": "2026-09-09T14:30:00-03:00", "datos": { ... } }
```

`version` es lo que permite que una exportación vieja se pueda importar
después de un cambio de modelo: sin ese número, la primera migración deja
inservibles todas las copias anteriores. La importación rechaza una
`version` que no conoce, en vez de adivinar.

El archivo contiene nombres reales de alumnos. Se guarda con el selector de
archivos del sistema, donde la docente elige dónde ponerlo, y no en una
carpeta pública ni en una ruta fija de la app.

Restaurar **reemplaza** todo lo que hay: es la acción más destructiva de la
app. Por eso, antes de reemplazar, la copia del estado actual queda guardada
en la base, y restaurar se puede deshacer una vez. Es la única forma de que
la regla de deshacer en lugar de confirmar valga también acá.

Leer un archivo de una versión más nueva que la app se **rechaza** en vez de
adivinar: importar a medias es peor que no importar.

La copia de seguridad automática de Android queda **desactivada**
(`android:allowBackup="false"`). Viene activada por defecto y subiría los
datos de la app —la base con los nombres— a la cuenta de Google del
teléfono, que es exactamente la copia remota que este diseño no tiene. Por
eso la exportación manual no es una comodidad: es la única red que queda.

---

## 3. Filtro de anonimización

**La IA nunca recibe un nombre de alumno** (regla innegociable 1). Esta
sección define cómo se cumple.

Aplica a todo texto que salga del dispositivo hacia el servicio de IA, sin
excepción: observaciones, borradores de mensajes, entradas de agenda,
preguntas libres del docente al asistente.

### 3.1 Principio rector

**Errar por exceso.** Sustituir de más produce un texto un poco raro;
sustituir de menos produce una fuga. Ante la duda, el filtro sustituye.

### 3.2 Índice de nombres conocidos

Se construye en memoria desde IndexedDB, en el momento de filtrar:

- Nombre completo, apellido completo, y **cada palabra por separado** de
  ambos, de todos los alumnos del docente (no sólo los de la materia en
  curso: el texto puede mencionar a cualquiera).
- Cada entrada en forma normalizada: minúsculas, sin acentos, sin signos.
- El nombre del propio docente y el nombre de la escuela también entran al
  índice, y se sustituyen por `la docente` y `la escuela`.

La coincidencia es **por palabra completa**, con límites de palabra Unicode
— nunca por subcadena, para no romper palabras que contienen un nombre
adentro.

### 3.3 Pipeline

Cuatro pasos, en este orden, sin saltear ninguno:

**a. Sustitución determinística.** Cada nombre conocido se reemplaza por un
alias neutro y estable: `Estudiante A`, `Estudiante B`, … El mismo alumno
recibe el mismo alias durante toda la conversación, para que el texto
mantenga sentido. Los alias no llevan género ni número de lista.

**b. Barrido heurístico.** Sobre el texto ya sustituido se busca lo que el
índice no puede conocer:

- Palabras capitalizadas fuera de inicio de oración que no estén en la
  lista de palabras comunes y lugares: se marcan como **posible nombre no
  conocido** (por ejemplo, un hermano, un docente de otra materia).
- Teléfonos, correos, URLs, arrobas y secuencias largas de dígitos: se
  sustituyen por un marcador genérico.

Lo marcado en este paso no se envía hasta que el docente decida en el paso
siguiente.

**c. Pantalla de revisión obligatoria.** El docente ve el texto **exacto**
que se va a enviar, con las sustituciones resaltadas y los posibles nombres
no conocidos señalados esperando decisión. Puede editar el texto final.

Esta pantalla no se puede desactivar, no tiene "no volver a mostrar" y no
se saltea cuando el envío se dispara desde otra pantalla. Su acción
primaria es *Enviar*; la secundaria, *Volver*.

**d. Segundo escaneo defensivo.** Justo antes del envío, sobre el payload
final —ya con las ediciones del docente— se vuelve a correr la sustitución
del paso (a). Si aparece un nombre conocido, **el envío no ocurre**: se
vuelve a la revisión con el hallazgo marcado.

Este paso existe para el caso concreto de que el docente vuelva a escribir
un nombre a mano en la pantalla de revisión. Sin él, la revisión sería el
punto por donde se filtra un nombre.

### 3.4 El mapa alias → alumno

El mapa vive **sólo en memoria**, en el estado de la sesión del asistente.

- No se persiste en IndexedDB, ni en `localStorage`, ni en ningún store con
  persistencia.
- No se serializa: no entra en el payload, no se loguea, no viaja en
  telemetría ni en reportes de fallo.
- Se limpia al cerrar la pantalla del asistente.

Conviene tenerlo en cuenta al elegir manejo de estado y reporte de errores:
un store persistido o un crash reporter que capture el estado completo
rompen esta regla sin que nadie escriba una línea de código maliciosa.

Por eso la sesión **falla al serializarse**: su `toJSON` tira un error. Si
algún día un store con persistencia, un log o un reporte de fallo intenta
guardarla, rompe fuerte en vez de escribir nombres de alumnos en disco sin
que nadie se entere.

### 3.5 La respuesta

La respuesta de la IA vuelve con los alias. Se re-personaliza
**localmente**, en el dispositivo, usando el mapa en memoria, sólo para
mostrarla. Si el docente guarda ese texto como observación, se guarda con
los nombres reales: es un dato local, y ahí sí corresponde.

### 3.6 Prueba

El filtro es una función pura y su batería de tests es parte del criterio
de "hecho" del asistente, no un agregado posterior. Casos mínimos: nombre
compuesto, apellido que también es palabra común, nombre en minúscula,
nombre con acento escrito sin acento, nombre pegado a un signo de
puntuación, y el caso del paso (d) —nombre reescrito en la revisión.

---

## 4. Backend

### 4.1 Qué es

Un **proxy delgado y sin estado** hacia el proveedor de IA. Existe por una
sola razón: no meter la clave de API del proveedor dentro del APK.

### 4.2 Qué no tiene

- **No tiene base de datos de alumnos.** No tiene base de datos.
- **No guarda prompts ni respuestas.** El texto pasa y no queda.
- No tiene cuentas, ni email, ni login. La app se identifica con un token
  de instalación anónimo generado en el dispositivo, que sirve para
  limitar el uso y para nada más.

### 4.3 Registro

Sólo metadata operativa: momento, código de estado, latencia, cantidad de
tokens, token de instalación. **Nunca el cuerpo del pedido ni el de la
respuesta.** Esto se decide ahora porque un log de cuerpos agregado más
tarde "para depurar" es exactamente la forma en que se filtra un texto.

### 4.4 Proveedor y modelo

**Claude API de Anthropic**, modelo `claude-opus-5`, a través del SDK
oficial `@anthropic-ai/sdk` desde el proxy — nunca desde la app, que no
tiene la clave.

Configuración de partida:

- `thinking: { type: "adaptive" }` y `output_config: { effort: "low" }`.
  Redactar una observación o un mensaje es trabajo corto: el esfuerzo alto
  no mejora el resultado y cuesta más. Se sube sólo si se mide que hace
  falta, y por caso de uso, no en general.
- Respuesta en streaming, para que el texto aparezca de a poco en el
  teléfono en vez de dejar la pantalla quieta.
- `stop_reason` se lee **antes** que el contenido: si el clasificador del
  modelo rechaza un pedido, la respuesta llega con `stop_reason: "refusal"`
  y sin texto útil. Se habilita el respaldo del servidor
  (`fallbacks: "default"`) para que un rechazo no deje la pantalla vacía.
- Sin prefill del turno del asistente: `claude-opus-5` lo rechaza. El
  formato de la respuesta se controla desde la instrucción de sistema.

Se contrata con retención cero de datos donde esté disponible, y sin uso de
lo enviado para entrenamiento. Aun así, el filtro de la sección 3 no se
relaja: el compromiso del proveedor es una segunda capa, no la primera.

### 4.5 Forma de los prompts

Tres reglas que la instrucción de sistema tiene que fijar, porque cada una
sostiene una regla del proyecto:

1. **Los alumnos llegan como `Estudiante A`, `Estudiante B`.** El modelo usa
   exactamente esos identificadores y no inventa nombres propios. Si
   inventara uno, la re-personalización de la respuesta (3.5) lo dejaría
   pasar como si fuera un alumno real.
2. **No se califica a la persona.** El texto describe hechos observables —
   qué entregó, qué dijo, a qué faltó— y no atribuye estados de ánimo,
   actitudes ni rasgos. Vale para la salida del modelo igual que para el
   resto de la app.
3. **Nada de salud ni de diagnóstico**, ni siquiera si el texto del docente
   lo insinúa.

Los prompts se versionan con el código, en archivos propios, no incrustados
entre la lógica de la pantalla.

### 4.6 Sin red

El asistente es la **única** función que necesita conexión. Sin red, la app
funciona completa: asistencia, notas, agenda, observaciones y dictado. El
asistente muestra que no está disponible ahora, sin dramatismo, y el resto
sigue andando.

---

## 5. Riesgos

| Riesgo | Qué lo dispara | Mitigación |
|---|---|---|
| Un nombre de alumno llega a la IA | Texto libre con un nombre que el índice no cubre | Pipeline de la sección 3.3 completo, con el principio de errar por exceso |
| El docente reescribe un nombre en la revisión | Edición manual en el último paso | Segundo escaneo defensivo (3.3.d): el envío no ocurre |
| El mapa alias → alumno se persiste sin querer | Store persistido, log de estado, reporte de fallo que captura memoria | El mapa nunca sale de memoria (3.4); revisar el reporte de fallos antes de publicar |
| Una plantilla con nombre llega a un grupo | Plantilla individual reutilizada como grupal | Validación en la capa de datos (2.6), no en la interfaz |
| El dictado cae a reconocimiento por servidor | Cambio de plugin, cambio de versión de Android, respaldo automático del plugin | Módulo propio que verifica disponibilidad local; si no hay reconocimiento local, el micrófono no aparece (regla innegociable 2) |
| Un nombre de alumno aparece en una notificación en la pantalla bloqueada | Recordatorio que muestra el texto que escribió el docente | Cuerpo fijo, materia y curso en el título, nada escrito por el docente (1.5) |
| Pérdida total de datos | Desalojo de IndexedDB, teléfono roto o perdido | Exportación manual a archivo (2.10); no hay copia remota por diseño |
| El archivo exportado, que sí tiene nombres reales, queda en un lugar poco cuidado | Exportación guardada en una carpeta que se sincroniza sola a la nube | Se guarda con el selector de archivos del sistema, elegido por la docente; la pantalla de exportación dice qué contiene el archivo |
| "Hoy" muestra el día equivocado | Uso de UTC en una fecha de calendario | Fechas locales como texto (2.7); tests con zona `America/Argentina/Buenos_Aires` a las 23:30 |
| Un registro duplicado hace mentir el promedio | Doble toque | Índices únicos y upsert por par en la capa de datos (2.3) |
| La IA devuelve una etiqueta sobre un alumno | Redacción asistida de observaciones | Instrucción de sistema que prohíbe calificar personas; el docente edita antes de guardar; ningún texto de la app califica a un alumno |
| Rechazo o revisión extra en Play Store | Política de datos de menores | La app no recolecta ni transmite datos personales; declarar con precisión qué viaja al asistente y qué no |
| Alguien mira el teléfono del docente | Uso en sala de profesores | Fuera del MVP; bloqueo con la credencial del dispositivo más adelante (6.2) |

---

## 6. Decisiones técnicas

### 6.1 Interfaz y manejo de estado

**React + TypeScript sobre Vite**, con **Dexie** para IndexedDB.

Qué aporta cada pieza, y por qué esa y no otra:

- **Vite** empaqueta la web app que Capacitor mete en el APK. Arranque
  rápido en desarrollo, salida estática, sin servidor.
- **Dexie** expresa los índices únicos compuestos de la sección 2.3
  —`[claseSesionId+alumnoId]` y `[evaluacionId+alumnoId]`— de forma
  directa, y da migraciones de esquema versionadas, que es exactamente lo
  que la exportación de 2.10 necesita para seguir siendo importable.
- Las **consultas reactivas** de Dexie (`liveQuery`) hacen que las
  pantallas se actualicen solas cuando cambia la base. Con eso, casi todo
  el estado de la app es la base de datos.

**No hay librería de manejo de estado global, y menos con persistencia.**
No es sólo una preferencia: un store persistido es la forma más probable de
que el mapa alias → alumno de la sección 3.4 termine escrito en disco sin
que nadie lo haya decidido. El poco estado que no es la base —la sesión del
asistente— vive en memoria y muere con la pantalla.

Por la misma razón, si más adelante se agrega reporte de fallos, se revisa
antes que no capture el estado de la aplicación.

### 6.2 Bloqueo de la app

**Fuera del MVP.** El riesgo que cubre —alguien mira el teléfono en la sala
de profesores— es real pero menor frente al costo de sumar una pantalla de
desbloqueo a una app que se usa entre dos clases, apurada, con una mano.

Cuando entre, entra así: con la **credencial del dispositivo** (el mismo
PIN, patrón o huella que desbloquea el teléfono), nunca con un PIN propio
de la app, y detrás de un módulo propio como cualquier otra API nativa.

### 6.3 Lo demás, ya resuelto en su sección

- Formato de la exportación: sección 2.10.
- Proveedor de IA, modelo y forma de los prompts: secciones 4.4 y 4.5.

## 7. Lo que sigue sin definir

Queda poco, y nada de estructura. Lo que falta se congela al construir cada
parte, no antes:

- **El texto de los prompts.** La forma está en 4.5; las palabras exactas se
  escriben con el asistente andando, porque se ajustan probando.
- **El esquema de la exportación campo por campo.** La `version 1` se
  congela cuando la capa de datos esté terminada: fijarla antes garantiza
  tener que corregirla.

Si aparece una decisión estructural nueva mientras se construye, entra en
este documento antes que en el código.
