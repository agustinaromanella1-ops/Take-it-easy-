# Take It Easy — Especificación v2

Agenda docente para profesores de secundaria en Argentina. Este documento
describe **qué hace la app**: para quién es, qué problemas resuelve, qué
funcionalidades tiene y en qué orden se construyen. El **cómo** (pantallas,
modelo de datos, riesgos) vive en `take-it-easy-diseno-previo.md`.

## 1. Propósito

Un docente de secundaria en Argentina suele dar clase en varios cursos, en
más de una escuela, con decenas de alumnos por materia. Take It Easy es la
agenda de bolsillo para esa rutina: tomar asistencia, anotar una
observación entre clase y clase, cargar una nota, ver de un vistazo qué toca
hoy. No reemplaza al libro de calificaciones oficial de la escuela; es la
herramienta personal del docente para no perder el hilo.

## 2. A quién sirve

- Docentes de nivel secundario, en una o varias escuelas.
- Uso mayormente durante la jornada escolar, con el teléfono en la mano,
  entre turnos de 40-80 minutos, sin conexión garantizada.
- Cero expectativa de que el alumno o la familia usen la app: es una
  herramienta unipersonal del docente.

## 3. Qué NO es

- No es un sistema administrativo de la escuela ni reemplaza al SIE/libro
  de temas oficial.
- No es una red social ni un canal de mensajería con familias (los
  "mensajes" del punto 4.8 son borradores que el docente redacta y envía
  por fuera de la app, por sus propios canales).
- No es un sistema de gestión de salud ni de seguimiento pedagógico
  clínico: no hay lugar para diagnósticos ni sospechas diagnósticas, en
  ninguna pantalla (regla innegociable 5).
- No depende de que el colegio adopte nada: corre sola, con los datos del
  propio docente, sin backend con base de alumnos (regla innegociable 7).
- **No tiene asistente de inteligencia artificial.** Lo tuvo especificado y
  construido, y se retiró: lo que la app resuelve —tomar asistencia, anotar
  una observación, redactar un mensaje— se resuelve en el día a día sin IA.
  Sacarlo dejó a la app sin servidor, sin clave de API, sin costo por uso y
  sin ningún texto que salga del teléfono. El detalle de por qué está en la
  sección 3 del documento de diseño.

## 4. Funcionalidades

Se listan en el orden en que se construyen (ver `Orden de trabajo` más
abajo). Cada una asume las reglas innegociables del proyecto: capa privada
por defecto, sin dictado por servidor, sin datos sensibles, fechas locales.

### 4.1 Cursos, materias e inscripciones

- El docente da de alta las materias/cursos que dicta (nombre, escuela,
  año/división, horario semanal).
- Un alumno se carga una sola vez y se inscribe en una o más materias — no
  es un dato que cuelgue del curso (ver modelo de datos en el documento de
  diseño). Esto evita duplicar al mismo alumno si el docente lo tiene en
  dos materias distintas.
- Se puede dar de baja una inscripción (el alumno se fue del curso) sin
  borrar el historial de asistencia/notas ya cargado.

### 4.2 Carga de alumnos

- Alta manual, alumno por alumno.
- Alta masiva por **pegado y parseo**: el docente pega una lista (por
  ejemplo, copiada de una planilla) y la app la interpreta en filas de
  nombre y apellido, con una pantalla de revisión antes de confirmar el
  alta (evita crear alumnos mal parseados).
- Nunca se piden ni se guardan DNI, domicilio, fecha de nacimiento ni foto
  (regla innegociable 6).

### 4.3 Asistencia

- Registro por clase dictada (sesión de una materia en una fecha
  puntual), no por día calendario genérico — un docente puede dar la
  misma materia dos veces el mismo día en cursos distintos.
- Estados mínimos: presente, ausente, tarde (y los que defina el diseño
  de interacción); la lectura de cada estado no depende sólo del color,
  siempre hay letra o texto acompañando.
- Tocar dos veces al mismo alumno en la misma clase actualiza el registro,
  nunca lo duplica — la unicidad `[claseSesionId + alumnoId]` la garantiza
  la capa de datos (regla del modelo de datos), no la interfaz.
- Registrar asistencia es la acción primaria de su pantalla; no hay
  diálogo de confirmación por alumno, y deshacer un toque es siempre
  posible.

### 4.4 Hoy

- Pantalla de arranque de la app: qué clases tiene el docente en el día
  calendario actual (hora local Argentina), en qué orden, y accesos
  directos a tomar asistencia de la clase que sigue.
- Si no hay clases cargadas para hoy, la pantalla invita a cargar el
  horario en vez de mostrar un estado vacío que pida disculpas.

### 4.5 Calificaciones

- Evaluaciones por materia (nombre, fecha, tipo — parcial, trabajo
  práctico, oral, lo que el docente defina).
- Nota por alumno por evaluación, con la misma garantía de unicidad que la
  asistencia: el par `[evaluacionId + alumnoId]` es único, así un doble
  toque no hace mentir el promedio.
- Vista de promedio por alumno y por curso, calculada localmente.

### 4.6 Agenda

- Planificación simple de lo que se va a dar o hacer en cada clase futura
  (temas, tareas asignadas, materiales a llevar).
- Recordatorios con notificaciones locales del sistema — **inexactas**
  (no se pide el permiso de alarma exacta de Android) — que se
  reprograman solas si el teléfono se reinicia.

### 4.7 Observaciones

- Notas libres del docente sobre un alumno o un curso: hechos, no
  etiquetas ("no entregó la tarea", no "está desganado").
- Toda observación nueva nace en la **capa privada** (regla innegociable
  4): sólo el docente la ve, siempre, salvo que decida explícitamente
  cambiarla de capa.
- Sin campos de salud ni de sospecha diagnóstica, en ningún formulario de
  esta pantalla (regla innegociable 5).

### 4.8 Mensajes

- Borradores de texto que el docente redacta para comunicarse con una
  familia o un alumno (por ejemplo, para copiar y pegar en WhatsApp o
  email institucional) — la app no envía nada por sí misma ni gestiona
  contactos.
- Una plantilla de mensaje u observación que nombra a un alumno no puede
  aplicarse a un grupo entero: ese bloqueo lo valida la capa de datos, no
  un aviso que el docente puede ignorar (regla innegociable 3).

### 4.9 Dictado por voz

- Disponible donde tenga sentido cargar texto por voz (observaciones,
  mensajes, agenda).
- Sólo reconocimiento de voz **local**, en el dispositivo. Si el equipo no
  lo soporta, el micrófono directamente no aparece y se usa el teclado.
  Nunca hay una alternativa por servidor, ni siquiera como respaldo
  (regla innegociable 2).

## 5. Fuera de alcance del MVP

- Integración con Google Calendar.
- Integración con Google Classroom.
- Cualquier forma de sincronización entre dispositivos o backend con base
  de datos de alumnos (regla innegociable 7): los datos viven en el
  dispositivo, en IndexedDB.

Sin asistente de IA, la app **no necesita internet para nada**. No es una
degradación elegante: no hay ninguna función que dependa de la red.

## 6. Plataforma

- Web app empaquetada con **Capacitor** para Android, distribuida por Play
  Store. No TWA, no PWA pura (decisión tomada).
- Todo acceso a APIs nativas (dictado, notificaciones) pasa por un módulo
  propio por función; las pantallas nunca llaman un plugin nativo
  directo, para que cambiar de plugin sea tocar un solo archivo.

## 7. Orden de trabajo

1. Proyecto Capacitor corriendo en un teléfono real, con una pantalla
   mínima.
2. Modelo de datos y capa de persistencia (IndexedDB).
3. Cargar alumnos (pegado y parseo) — sección 4.2.
4. Asistencia — sección 4.3.
5. Hoy — sección 4.4.
6. Recién entonces: calificaciones, agenda, observaciones y mensajes —
   secciones 4.5 a 4.8.

Empaquetar temprano, no al final: el proyecto Capacitor tiene que andar en
un teléfono real desde el paso 1, no como última etapa.

## 8. Criterios de éxito

- Un docente puede tomar asistencia de un curso completo en menos tiempo
  del que tardaría con papel, incluso sin conexión.
- Ninguna de las reglas innegociables de este proyecto se relaja para
  cumplir una funcionalidad de esta lista: si una funcionalidad choca con
  una regla, la regla gana y la funcionalidad se replantea.
