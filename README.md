# PsicoFinance

Agenda y finanzas para consultorio psicológico. Gestiona pacientes, turnos, honorarios y cobros,
y muestra en todo momento cuánto se facturó, cuánto se cobró y quién debe.

## Cómo usarla

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Para publicarla (Netlify, Vercel, GitHub Pages o un pendrive):

```bash
npm run build    # genera dist/
```

La carpeta `dist/` es HTML estático: no necesita servidor ni base de datos.

## Qué hace

**Inicio.** Facturado y cobrado del mes, deuda pendiente y turnos de la semana. Avisa de las
sesiones que ya pasaron pero siguen sin cerrar y permite cerrarlas ahí mismo.

**Pacientes.** Tarjetas con honorario, tipo (particular, institución o evaluación), frecuencia,
sesiones realizadas, porcentaje de cancelación, saldo y fecha del último aumento. Color
identificatorio, botón de WhatsApp, y ficha con historial de sesiones, pagos y saldo.

**Agenda.** Tres vistas en pestañas: **Día** (los pacientes de la jornada, con estado y acciones a
mano), **Semana** (grilla de siete días) y **Mes** (calendario con un punto del color de cada
paciente en los días con sesión). Detecta y marca turnos superpuestos. Una serie recurrente
(semanal, quincenal o mensual) se carga de una sola vez, y cada turno se puede mandar al calendario
del teléfono con alarma.

**Finanzas.** Meta mensual con barra de avance, calculadora de cuánto cobrar por sesión,
comparación de facturado contra cobrado mes a mes, saldos pendientes y registro de pagos con un
botón para saldar la deuda completa de un paciente.

**Ajustes.** Moneda, duración por defecto, política de ausencias, antelación de la alarma, y
exportar/importar los datos.

## Estética

Serif de display (Playfair Display) para títulos y cifras principales, sans redondeada (Nunito)
para el cuerpo, fondo en degradado pastel, tarjetas muy redondeadas y acento turquesa. Los títulos
de sección van fuera de la tarjeta, con su acción a la derecha.

La mascota es un perro salchicha dibujado en SVG con tres poses —estirado, corriendo y echado— que
se alternan al tocarlo. Es dibujo propio en estilo de línea continua, no una copia de ninguna
ilustración existente. En celular
la navegación pasa a una barra inferior con un botón flotante para la acción principal de cada
pantalla. Las fuentes están alojadas en el propio proyecto en lugar de pedirlas a Google: así la app se ve
igual sin conexión (una PWA que depende de un CDN externo pierde su tipografía apenas se corta
internet), carga más rápido y no le avisa a un tercero cada visita. Son 144 KB, solo los
subconjuntos latinos y un archivo por familia, porque son fuentes variables.

## Decisiones de diseño

**El dinero se guarda en centavos, como entero.** Sumar decimales acumula error de redondeo:
`0.1 + 0.2` no da `0.3` en punto flotante. Todo el cálculo es entero y solo se formatea al
mostrarlo (`src/lib/money.ts`). El parser acepta tanto `1.500,50` como `1,500.50`, y al mostrar
se omiten los centavos cuando son cero: `$ 35.000`, no `$ 35.000,00`.

**Las fechas son `YYYY-MM-DD` en hora local, no timestamps UTC.** `new Date("2026-03-10")` se
interpreta como UTC y puede correr el día según la zona horaria; un turno del martes a las 15:00
tiene que seguir siendo el martes a las 15:00 (`src/lib/dates.ts`).

**El honorario se congela en cada sesión.** Se copia del paciente al agendar, pero después no se
toca: subir la tarifa no debe reescribir lo ya facturado.

**Una sesión genera deuda solo si se realizó, o si fue una ausencia marcada como cobrable.** Las
canceladas y las todavía programadas no cuentan. El saldo de un paciente es facturado − pagado;
si es negativo, tiene crédito a favor.

**Lo que vuelve de `localStorage` se valida campo por campo** (`src/lib/storage.ts`). Es texto que
pudo corromperse o quedar de una versión vieja; se descarta lo inválido en vez de confiar en un
`as AppData` y que la app explote más tarde y lejos de la causa.

**La calculadora de tarifa razona al revés.** No parte del honorario sino de lo que la persona
necesita llevarse: suma los gastos fijos, agranda el total para que sobreviva a los impuestos, y
lo divide por las sesiones que realmente se cobran (no las agendadas). El resultado se redondea
hacia arriba a una cifra que alguien cobraría de verdad: sugerir `$17.094,02` es correcto e
inservible (`src/lib/pricing.ts`).

**La repetición mensual no arrastra el recorte.** Un turno del 31 de enero cae el 28 de febrero,
pero el siguiente vuelve al 31 de marzo. Avanzar sumando meses sobre la fecha ya recortada correría
la serie al día 28 para siempre (`src/lib/recurrence.ts`).

**El recordatorio es un archivo `.ics`, no una notificación web.** Abrirlo en el teléfono agrega el
turno al calendario con alarma, así el aviso llega aunque la app esté cerrada o el navegador no
tenga permisos (`src/lib/calendar.ts`).

**El teléfono se normaliza antes de armar el enlace de WhatsApp.** `wa.me` necesita formato
internacional y solo dígitos; un número copiado de la agenda casi nunca viene así, y hay que sacarle
el 0 de larga distancia y el 15 de celular (`src/lib/contact.ts`).

**Borrar un paciente arrastra sus sesiones y pagos.** Dejarlos sueltos produciría ingresos
fantasma en los reportes, imposibles de rastrear.

**Renombrar la app no puede borrar datos.** La app tuvo otros nombres antes, y los datos guardados
bajo esos nombres se leen igual: si no hay nada bajo la clave actual se buscan las anteriores, de la
más reciente a la más vieja. Ese orden importa — quien pasó por varias versiones tiene datos en
varias claves, y los buenos son los de la última que usó. Las claves viejas no se borran, quedan
como respaldo (`src/lib/storage.ts`).

**Al cerrar la pestaña solo se guarda si hay cambios propios sin escribir.** Sin esa condición,
una pestaña que nunca tocó nada igual escribiría su copia al cerrarse y pisaría lo que guardó
otra pestaña abierta en paralelo (`src/store/StoreContext.tsx`).

## Publicarla y usarla en el celular

La app es una PWA instalable: se puede poner en la pantalla de inicio del
teléfono y **funciona sin internet**, incluidas las tipografías.

### Publicar en Netlify

1. Entrá a [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
2. Elegí GitHub y el repositorio `Take-it-easy-`.
3. La rama a publicar: `claude/psicofinance-review-mxf861` (o `main`, si ya la fusionaste).
4. No hace falta tocar nada más: `netlify.toml` ya trae el comando de compilación,
   la carpeta a publicar, las redirecciones y las cabeceras de caché.
5. **Deploy site**.

Cada vez que se suba un commit a esa rama, Netlify vuelve a publicar sola.

### Instalarla en el teléfono

- **Android (Chrome):** abrí el sitio → menú ⋮ → *Instalar aplicación*.
- **iPhone (Safari):** abrí el sitio → compartir → *Agregar a inicio*.

Queda como una app más: ícono propio, sin barra del navegador, y abre aunque no
haya señal.

### Actualizaciones

El service worker descarga la versión nueva en segundo plano y la aplica
**cuando salís de la app**, no mientras la estás usando: interrumpir la carga de
una sesión para actualizar sería peor que esperar al próximo arranque.

## Publicar como app de Android

La app es una PWA: se puede envolver como app de Play Store con PWABuilder o Bubblewrap. Eso genera
un archivo `signing.keystore` con su contraseña, que hace falta para publicar **cada actualización**
futura de la misma ficha de Play.

Ese keystore y su contraseña no van nunca al repositorio — ya están en `.gitignore`. Quien tenga
ambos puede publicar actualizaciones haciéndose pasar por la app. Guardalos en un gestor de
contraseñas, no en una captura de pantalla ni en un chat.

## Dónde viven los datos

Todo se guarda en el navegador (`localStorage`), en esta computadora. No hay servidor ni cuenta:
nada se envía a ningún lado. Como contrapartida, **limpiar la caché o cambiar de computadora
borra el historial**, así que conviene exportar una copia desde Ajustes cada tanto.

## Desarrollo

```bash
npm test          # 139 tests unitarios
npm run typecheck # TypeScript en modo strict
npm run build
```

```
src/
├── types.ts            Modelo de datos
├── lib/                money, dates, storage, pricing, recurrence, calendar,
│                       contact, palette — lógica pura, sin React
├── store/              reducer, selectores y contexto
├── components/ui.tsx   Card, Stat, Modal, Field
└── pages/              Dashboard, Patients, PatientDetail, Agenda, Finance, Settings
```

La lógica de negocio vive en `lib/` y `store/`, sin depender de React, y es la parte cubierta por
los tests. Los componentes solo muestran lo que esas funciones calculan.
