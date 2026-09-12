# Take It Easy

Agenda docente para profesores de secundaria en Argentina. Web app empaquetada
con Capacitor para Android.

- `take-it-easy-especificacion-v2.md` — qué hace la app
- `take-it-easy-diseno-previo.md` — pantallas, modelo de datos y riesgos
- `prototipos/` — cuatro pantallas en HTML, referencia visual

## Correr en el navegador

```
npm install
npm run dev
```

Sirve para trabajar rápido, pero no reemplaza probar en un teléfono: lo que se
rompe en Android —el botón atrás, las zonas seguras, el teclado— no se ve acá.

## Correr en un teléfono

Hace falta Android Studio con el SDK instalado, y el teléfono en modo
desarrollador con la depuración por USB activada.

```
npm run build
npx cap sync android
npx cap run android
```

Para abrir el proyecto nativo en Android Studio: `npx cap open android`.

Después de cada cambio en la web app hay que volver a correr `npm run build &&
npx cap sync android`: lo que corre en el teléfono es lo que quedó en `dist/`,
no lo que está en `src/`.

## Estado

Andando: materias y escuelas, carga de alumnos pegando la lista, asistencia,
Hoy con el horario semanal, evaluaciones y carga de notas, archivar y recuperar una materia, copia de
seguridad a archivo y restaurarla, e instructivo con pistas. Cada push compila
un APK que se puede instalar desde el teléfono.

Falta: observaciones y ficha de alumno, agenda con
recordatorios, mensajes y dictado por voz.

La app **no necesita internet**. Todo vive en el teléfono, en IndexedDB, y no
hay ninguna función que dependa de la red.
