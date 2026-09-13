# Prototipos

Cuatro pantallas en HTML, para abrir en el navegador. Referencia visual y de
interacción, no código a reutilizar.

| Archivo | Pantalla |
|---|---|
| `hoy.html` | Hoy — las clases del día y la asistencia de la que sigue |
| `asistencia.html` | Asistencia — marcar el estado de cada alumno |
| `cargar-alumnos.html` | Pegar la lista — revisar el parseo antes del alta |
| `ficha-alumno.html` | Ficha de alumno — asistencia, promedio y observaciones |

## Estado: aprobados

Cuando una pantalla y `take-it-easy-diseno-previo.md` no coincidan, gana el
prototipo, y lo que hay que corregir es el documento.

La excepción es lo que todavía no está construido: la barra inferior de `hoy.html`
muestra Agenda y Ajustes, que son la forma a la que hay que llegar, no pestañas
para agregar ahora. Una pestaña que no lleva a ningún lado es peor que una que
falta.

## Qué muestran a propósito

- Una sola acción primaria por pantalla, en `#7B5EA7` con texto blanco.
- Los estados de asistencia se leen por letra y palabra, nunca sólo por color.
- "Justificada" no es un cuarto estado: es una marca sobre la ausencia o la
  llegada tarde, y se lee como texto debajo del nombre.
- El promedio sale sólo de las evaluaciones numéricas, y la tarjeta dice
  cuántas quedaron afuera.
- Verde salvia sólo en "presente", como borde y punto, nunca como fondo ni en
  botones.
- Cada pastel lleva el tono oscuro de su propio par como color de texto.
- Deshacer en lugar de confirmar: barra de deshacer, cero diálogos modales.
- Tono calmo, sin signos de exclamación. Los textos describen hechos.

## Qué no aparece, también a propósito

- Foto, DNI, domicilio, fecha de nacimiento, teléfono o contacto de familia.
- Cualquier campo de salud, diagnóstico o sospecha diagnóstica.
- Cualquier texto que califique a un alumno.

Los nombres son inventados.
