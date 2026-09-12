# Take It Easy — Diseño previo

Cómo se construye lo que describe `take-it-easy-especificacion-v2.md`:
pantallas, modelo de datos y riesgos.
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

### 1.3.1 La barra de secciones está siempre

La barra de abajo —Hoy, Materias, Agenda, Ajustes— está pegada al borde de
la ventana, no al final del documento.

Estuvo un tiempo en el flujo normal, y en una pantalla con una lista larga
—tomar asistencia de un curso de 28, la materia con todos sus alumnos—
quedaba a mil cuatrocientos píxeles de scroll. Había que recorrer el curso
entero para poder pasar a Ajustes, y al llegar abajo ya no se veía la flecha
de volver: las dos salidas nunca estaban juntas. Una pantalla de la que no se
ve cómo salir se lee como un camino sin salida, aunque técnicamente no lo
sea.

El pie de cada pantalla se pega justo encima de la barra, no al borde de la
ventana, o la taparía. La barra tiene alto fijo (`--alto-nav`) para que ese
número sea cierto por construcción y no uno adivinado.

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
Cambiar de capa es una acción explícita y posterior del docente: un toque
sobre la etiqueta de la observación, que la devuelve a privada con otro
toque. Ese segundo toque es el deshacer, y por eso no hace falta un diálogo
de confirmación.

Borrar una observación tampoco lo lleva: se borra y queda una barra para
deshacer, como en el resto de la app. Deshacer la devuelve con su id, su
fecha y su capa, no como una observación nueva. Si volviera con la fecha de
hoy, deshacer sería perder el dato en vez de recuperarlo.

### 2.6 Plantillas: el bloqueo del nombre

Una `Plantilla` de ámbito `grupal` no puede contener un nombre de alumno
(regla innegociable 3). La validación vive en la **capa de datos**: al
guardar una plantilla grupal, y al aplicarla a más de un alumno, el texto
se contrasta contra un índice de nombres conocidos —cada palabra de cada
nombre y apellido, normalizada, sin las partículas que no identifican a
nadie—. Si hay
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

La nota se contrasta contra la escala de su evaluación **en la capa de
datos**, no en el formulario: un 47 en una escala de 1 a 10 no es un cartel
que se pueda ignorar, es una escritura que no ocurre. Vale igual para una
etiqueta que no pertenece a esa escala, y para un número donde la escala
espera una etiqueta.

Un alumno sin nota vale `null`, nunca cero. El que falta corregir y el que
se sacó un cero son cosas distintas, y confundirlas hace mentir al promedio
justo cuando la corrección va por la mitad.

Borrar una evaluación se lleva sus notas. Una nota sin su evaluación no
significa nada: no se sabe contra qué escala leerla.

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

## 3. El asistente de IA, retirado

El diseño de este documento incluía un asistente de inteligencia artificial
—redacción asistida de observaciones y mensajes, y preguntas libres—, con
todo lo que hacía falta para que ningún nombre de alumno saliera del
teléfono: un filtro de anonimización, una pantalla de revisión obligatoria,
un segundo escaneo defensivo y un proxy sin base de datos que no registraba
ni un carácter del texto.

Se construyó entero y se retiró el 12 de septiembre de 2026, antes de
desplegarlo. El motivo es de producto, no técnico: **lo que la app resuelve
se resuelve en el día a día sin IA.** Tomar asistencia, anotar qué pasó en
una clase y redactar un mensaje son tareas que una docente hace mejor y más
rápido escribiéndolas que revisando lo que escribió una máquina.

Lo que costaba tenerlo, y dejó de costar:

- Un servidor prendido, con su precio mensual, que a este volumen salía más
  caro que la IA misma.
- Una clave de API y una cuenta en dólares.
- Una dirección de proxy adentro de un APK público, que obligaba a poner un
  techo diario a la factura porque no había forma de impedir el abuso sin
  cuentas ni login.
- Una superficie de privacidad entera: el único texto que salía del
  dispositivo era el del asistente, y era el único lugar donde un nombre
  podía filtrarse.

Sin asistente, la app **no necesita internet para nada**. No hay
degradación elegante que diseñar, no hay backend, no hay clave que cuidar, y
la declaración de datos de Play Store se vuelve trivial: no se transmite
nada.

Lo que sobrevive, porque nunca fue del asistente:

- **El índice de nombres conocidos** (`src/datos/nombres.ts`), que sostiene
  la regla innegociable 3: una plantilla grupal que nombra a un alumno se
  rechaza en la capa de datos (2.6).
- **El dictado por voz local** (regla innegociable 2), que no tiene nada que
  ver con la IA: es reconocimiento en el dispositivo o no existe.
- **La regla de que los datos son locales** (regla 7), que ahora no tiene
  ninguna excepción.

El diseño completo del filtro y del proxy —el pipeline de cuatro pasos, el
mapa alias → alumno que vivía sólo en memoria, la forma de los prompts— está
en la historia de este repositorio, hasta el commit que los quitó. Si algún
día vuelve la decisión, no hay que volver a pensarlo desde cero.

---

## 4. Riesgos

| Riesgo | Qué lo dispara | Mitigación |
|---|---|---|
| Una plantilla con nombre llega a un grupo | Plantilla individual reutilizada como grupal | Validación en la capa de datos (2.6), no en la interfaz |
| El dictado cae a reconocimiento por servidor | Cambio de plugin, cambio de versión de Android, respaldo automático del plugin | Módulo propio que verifica disponibilidad local; si no hay reconocimiento local, el micrófono no aparece (regla innegociable 2) |
| Un nombre de alumno aparece en una notificación en la pantalla bloqueada | Recordatorio que muestra el texto que escribió el docente | Cuerpo fijo, materia y curso en el título, nada escrito por el docente (1.5) |
| Pérdida total de datos | Desalojo de IndexedDB, teléfono roto o perdido | Exportación manual a archivo (2.10); no hay copia remota por diseño |
| El archivo exportado, que sí tiene nombres reales, queda en un lugar poco cuidado | Exportación guardada en una carpeta que se sincroniza sola a la nube | Se guarda con el selector de archivos del sistema, elegido por la docente; la pantalla de exportación dice qué contiene el archivo |
| "Hoy" muestra el día equivocado | Uso de UTC en una fecha de calendario | Fechas locales como texto (2.7); tests con zona `America/Argentina/Buenos_Aires` a las 23:30 |
| Un registro duplicado hace mentir el promedio | Doble toque | Índices únicos y upsert por par en la capa de datos (2.3) |
| Rechazo o revisión extra en Play Store | Política de datos de menores | La app no recolecta ni transmite nada: no hay red, ni backend, ni analítica. La declaración de datos dice exactamente eso |
| Alguien mira el teléfono del docente | Uso en sala de profesores | Fuera del MVP; bloqueo con la credencial del dispositivo más adelante (5.2) |

---

## 5. Decisiones técnicas

### 5.1 Interfaz y manejo de estado

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
La base de datos ya es el estado, y un store persistido encima sólo agrega
una segunda copia que se desincroniza. El poco estado que no es la base —el
paso en el que va un formulario, qué fila se está editando— vive en la
pantalla y muere con ella.

### 5.2 Bloqueo de la app

**Fuera del MVP.** El riesgo que cubre —alguien mira el teléfono en la sala
de profesores— es real pero menor frente al costo de sumar una pantalla de
desbloqueo a una app que se usa entre dos clases, apurada, con una mano.

Cuando entre, entra así: con la **credencial del dispositivo** (el mismo
PIN, patrón o huella que desbloquea el teléfono), nunca con un PIN propio
de la app, y detrás de un módulo propio como cualquier otra API nativa.

### 5.3 Firma de la app

Son dos claves distintas, con dueños y riesgos distintos. Confundirlas es el
error caro.

**La clave de prueba** (`android/app/prueba.keystore`) está versionada a
propósito, que es lo contrario de lo que se hace con una clave de firma.

Android identifica una app por el nombre del paquete **y** la firma. Si cada
compilación firma con una clave distinta, el teléfono ve la versión nueva
como una app ajena, avisa "conflicto con un paquete" y la única salida es
desinstalar. Desinstalar borra IndexedDB, que en esta app es la única copia
que existe de los datos. Es decir: una clave que cambia convierte cada
actualización en una pérdida total.

Guardarla entre compilaciones en vez de versionarla se probó y no alcanza:
depende de que el guardado no se venza, y el día que se venciera volvería a
pasar sin aviso, que es la peor forma de fallar.

Qué protege esta clave: nada. Sólo firma los APK de prueba que se instalan a
mano. Lo que habilita a quien tenga el repositorio es compilar un APK que se
instale encima de éste, y para eso hace falta convencer a la docente de
instalarlo a mano, igual que cualquier archivo bajado de internet.

**La clave de publicación** no se genera acá ni se versiona nunca. Se genera
en la computadora de la docente cuando la app vaya a Play Store, y de ahí no
se mueve.

Conviene ser preciso sobre el riesgo, porque la fama es peor que el hecho.
Play Store firma las apps nuevas con su propio esquema: Google guarda la
clave con la que se firma lo que llega a los teléfonos, y la docente sube el
paquete firmado con una **clave de subida**. Si esa clave de subida se
pierde, Google la repone. No es el escenario viejo de "se perdió la clave y
la app no se actualiza nunca más". Sigue conviniendo tener dos copias, una
de ellas fuera de la nube: reponerla lleva días y mientras tanto no se puede
publicar nada.

Mientras no exista esa clave, la compilación de publicación queda sin firmar
y el flujo automático compila sólo la de prueba. La configuración para
firmarla se agrega junto con la clave, no antes: configuración que no se
puede probar es configuración que se escribe mal.

### 5.4 Recordatorios

Notificaciones locales del sistema, con `@capacitor/local-notifications`. El
teléfono las programa y el teléfono las muestra: no hay servidor, no hay
push, no sale nada.

**Inexactas, y el permiso de alarma exacta se saca del manifiesto.** El
plugin declara `SCHEDULE_EXACT_ALARM`, así que la app lo quita con
`tools:node="remove"`. Pedirlo obligaría a mandar a la docente a una
pantalla de ajustes del sistema a habilitar un permiso especial, y para
"acordate de llevar los mapas" no vale la pena. A cambio, el aviso puede
llegar unos minutos más tarde, y por eso ningún texto promete una hora
(1.5).

**El aviso acompaña al día de su entrada.** Cambiar la fecha de la entrada
mueve el aviso a ese día, con la misma hora. Sin eso, una entrada para la
semana que viene quedaba con el aviso fechado hoy, y un aviso de hoy a las
7:30 leído a las diez de la mañana ya pasó: no suena nunca.

**Un aviso en el pasado se rechaza en la capa de datos.** No sonaría nunca o
sonaría en el acto, y las dos cosas son un aviso roto. La entrada se guarda
igual: lo que falló es el aviso, no lo que la docente escribió.

**Al arrancar, los pendientes se vuelven a programar.** Un reinicio del
teléfono, una reinstalación o un borrado de datos desde los ajustes se
llevan las notificaciones programadas; la base es la que sabe cuáles eran.
Reprogramar de más no molesta: el sistema reemplaza la notificación que
tiene el mismo id.

**El id de notificación es un entero sorteado y guardado.** Android
identifica una notificación con un entero de 32 bits, así que el uuid de la
entrada no sirve; y hace falta recordarlo para poder cancelarla.

**Dos opciones sin las que el aviso no suena, y que no se ven en ninguna
pantalla.** Quitar el permiso del manifiesto no alcanza: hay que pedirle al
plugin lo mismo que se decidió.

- `isExactNotification: false`. Viene en `true` por defecto, y con eso el
  plugin, al ver que la app no puede programar alarmas exactas, abre la
  pantalla «Alarmas y recordatorios» del sistema para que la docente dé el
  permiso. Como la app lo saca del manifiesto a propósito, esa pantalla
  aparece con el interruptor gris: un callejón sin salida que abría la app.
- `allowWhileIdle: true`. Sin esto el plugin programa con `AlarmManager.RTC`,
  que además de inexacto **no despierta al teléfono**, así que Doze lo
  posterga sin límite: un aviso para las 7:30 en un teléfono guardado no
  llega nunca. Con esto usa `setAndAllowWhileIdle(RTC_WAKEUP)`, que despierta
  y se entrega durante Doze. No hace falta ningún permiso: el permiso
  especial lo piden las variantes *exactas*, no ésta.

El precio es el que la app ya prometía: Android entrega como mucho uno de
estos cada nueve minutos por app. Sigue siendo inexacto, y por eso ningún
texto promete una hora (1.5).

Las dos están fijadas por tests, porque son invisibles: un `schedule({ at })`
pelado compila, anda en el navegador, pasa la revisión y en el teléfono no
llega nunca.

### 5.5 Dictado por voz

El dictado es local o no existe (1.2). Es la regla que decide qué plugin se
puede usar, y descarta al obvio.

**El plugin habitual no sirve.** `@capacitor-community/speech-recognition`
llama a `SpeechRecognizer.createSpeechRecognizer()` sin ninguna opción de
reconocimiento sin conexión. En la práctica eso manda el audio al servicio de
reconocimiento del teléfono, que en casi todos los Android es Google y lo
sube. Una observación dictada sobre un alumno se iría a un servidor.

**Se usa `@capgo/capacitor-speech-recognition`**, que expone
`createOnDeviceSpeechRecognizer()` y `EXTRA_PREFER_OFFLINE`. Lo que lo hace
elegible no es que pueda reconocer en el dispositivo, sino cómo se comporta
cuando no puede: rechaza. Hay tres puertas —disponibilidad, idioma soportado,
error en vivo— y las tres terminan en un rechazo explícito, ninguna en el
reconocedor del servidor.

**La app pregunta una sola cosa.** El plugin ofrece dos preguntas,
`available()` y `isOnDeviceRecognitionAvailable()`. La envoltura de la app
sólo tiene la segunda. "Hay reconocimiento" incluyendo el del servidor no es
disponibilidad para este proyecto, así que esa pregunta no se hace: un `true`
ahí no habilitaría nada.

**Las opciones se arman en una función sin parámetros.** No hay una rama que
pueda quedar sin `useOnDeviceRecognition`, porque no hay rama. `popup` queda
en `false` por la misma razón: el diálogo del sistema es el reconocedor de
Android.

**Si no se puede, el micrófono no aparece.** No es un botón gris con una
explicación: no se dibuja. Quien no lo tiene escribe con el teclado y no se
entera de que existía. Hace falta Android 13 o más nuevo y el idioma bajado.

**Un respaldo por servidor se escribe en dos líneas**, arregla un síntoma
real y rompe la regla en silencio. Por eso, además de los tests de
comportamiento, hay tres que miran la forma del módulo: que el micrófono se
encienda en un solo lugar, que `useOnDeviceRecognition: true` aparezca una
vez y `false` ninguna, y que `available()` no se consulte nunca. Se verificó
rompiéndolos: poner la opción en `false` y agregar un `catch` que reintenta
sin ella hacen fallar a los tests que corresponden.

**Apagado por ahora: el plugin cierra la app al preguntar.** Su
`isOnDeviceRecognitionAvailable` llama a `createOnDeviceSpeechRecognizer()` y
`checkRecognitionSupport()` sin pasar al hilo principal, y `SpeechRecognizer`
de Android sólo se puede usar desde ahí. Capacitor corre los métodos de los
plugins en un hilo aparte (`taskHandler.post`) y relanza cualquier excepción
con `throw new RuntimeException(ex)`: en ese hilo eso cierra la app entera. Se
ve al abrir la ficha de un alumno, que es la pantalla que pregunta al cargarse.
El `try/catch` de JavaScript no sirve: el proceso muere antes de que ninguna
promesa se rechace. Está igual en la 8.3.0.

Mientras tanto la app no toca el plugin: `seEscuchaAcaMismo()` devuelve `false`
sin preguntar, y como todo lo demás cuelga de esa respuesta, el micrófono no se
dibuja y no hay forma de llegar a `start`. La salida es un plugin propio de
unas pocas líneas que pregunte en el hilo principal, y de paso deja de ser una
dependencia de terceros.

**El permiso de micrófono se escribe también en el manifiesto de la app**,
aunque lo declare el plugin. Un permiso de este tamaño tiene que verse en el
repositorio y no llegar callado desde `node_modules`.

### 5.6 Lo demás, ya resuelto en su sección

- Formato de la exportación: sección 2.10.

## 6. Lo que sigue sin definir

Queda poco, y nada de estructura. Lo que falta se congela al construir cada
parte, no antes:

- **El esquema de la exportación campo por campo.** La `version 1` se
  congela cuando la capa de datos esté terminada: fijarla antes garantiza
  tener que corregirla.

Si aparece una decisión estructural nueva mientras se construye, entra en
este documento antes que en el código.
