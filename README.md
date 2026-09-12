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

**Pacientes.** Datos de contacto, datos para facturar (nombre completo, DNI, CUIT, condición frente
al IVA, obra social y número de afiliado) y tarjetas con honorario, tipo, frecuencia,
sesiones realizadas, porcentaje de cancelación, saldo y fecha del último aumento. Color
identificatorio, botón de WhatsApp, y ficha con historial de sesiones, pagos y saldo.

**Cierre del día.** Al terminar la jornada, un botón en la agenda abre el repaso de las sesiones
del día: en dos toques por paciente se marca vino / faltó / canceló y si ya se cobró. Todo entra
como un único cambio, con el resumen de lo facturado y lo cobrado antes de confirmar.

**Agenda.** Tres vistas en pestañas: **Día** (los pacientes de la jornada, con estado y acciones a
mano), **Semana** (grilla de siete días) y **Mes** (calendario con un punto del color de cada
paciente en los días con sesión). Detecta y marca turnos superpuestos. Una serie recurrente
(semanal, quincenal o mensual) se carga de una sola vez, y cada turno se puede mandar al calendario
del teléfono con alarma.

**Finanzas.** Tres pestañas. **Resumen**: meta mensual, facturado contra cobrado mes a mes, saldos
pendientes, registro de pagos y calculadora de tarifa. **Monitoreo**: quién pagó y quién debe,
asistencia por paciente y comparación de honorarios contra la tarifa sugerida. **Facturación**:
elegís mes y paciente y aparecen todos sus datos fiscales —nombre completo, DNI, CUIT, condición
frente al IVA, obra social y afiliado— para copiar uno por uno mientras completás el formulario, más
el texto de la factura listo para pegar.

**Ajustes.** Moneda, duración por defecto, política de ausencias, antelación de la alarma, y
exportar/importar los datos.

## Estética

Serif de display (Playfair Display) para títulos y cifras principales, sans redondeada (Nunito)
para el cuerpo, fondo en degradado pastel, tarjetas muy redondeadas y acento turquesa. Los títulos
de sección van fuera de la tarjeta, con su acción a la derecha.

La mascota es un perro salchicha de color plano dibujado en SVG, en el encabezado del inicio junto
al mensaje del día. Al tocarlo cambia el mensaje y mueve la cola. Va dibujado y no como emoji para
que se vea igual en todos los dispositivos: el emoji de perro cambia bastante entre Android, iOS y
Windows.

**Dos naranjas, no uno.** El naranja lindo (`--warm`, #e08a4f) no llega a 4,5:1 sobre blanco, así
que solo se usa en degradés y rellenos sin texto. Para texto y bordes hay un segundo tono más
oscuro (`--warm-ink`, #ad5417) que sí pasa. Lo mismo en el héroe: el turquesa de la interfaz da
3,2:1 sobre el degradé y ahí hay texto chico, así que ese bloque usa `--accent-ink` (#2f6273, 5,4:1).

**El naranja es calidez de marca, no jerarquía.** Turquesa es acción, el ámbar de los gráficos es
"pendiente", y el naranja queda para lo cálido y celebratorio. Si el naranja marcara además lo
importante, el mismo color tendría dos significados.

**Los degradés van sobre superficies grandes y tranquilas** —el héroe, el botón de cierre del día,
la burbuja de la mascota, el ícono— y nunca sobre marcas de datos, donde el color significa algo y
un degradé lo volvería ambiguo.

**`prefers-reduced-motion` anula todo el movimiento**, incluida la cola del perro, que ni siquiera
se monta. Para varias personas el movimiento no es adorno sino una distracción que compite con lo
que están tratando de hacer. En celular
la navegación pasa a una barra inferior con un botón flotante para la acción principal de cada
pantalla. Las fuentes están alojadas en el propio proyecto en lugar de pedirlas a Google: así la app se ve
igual sin conexión (una PWA que depende de un CDN externo pierde su tipografía apenas se corta
internet), carga más rápido y no le avisa a un tercero cada visita. Son 144 KB, solo los
subconjuntos latinos y un archivo por familia, porque son fuentes variables.

## Decisiones de diseño

**Los colores de los gráficos se validaron, no se eligieron a ojo.** El primer intento usaba verde
para "cobrado" y rojo para "pendiente" —el par clásico de los tableros— que resulta indistinguible
en deuteranopía: ΔE 4,2, cuando el mínimo aceptable es 8. El par azul/ámbar que quedó separa bien en
todos los tipos de daltonismo (ΔE ≥ 16). El gris de "canceladas" sí queda por debajo del piso de
saturación, pero es deliberado: representa el estado "no pasó nada" y su separación contra los otros
dos pasa cómoda (`src/components/charts.tsx`).

**Los valores van escritos sobre las barras, no en un globo al pasar el mouse.** La app se usa sobre
todo en el celular, donde el hover no existe.

**El nombre de la agenda y el de la factura son campos distintos.** En la agenda conviene un nombre
corto —"José H."— y la factura necesita el entero. Si el nombre completo está vacío se usa el de la
agenda, así nadie tiene que cargar lo mismo dos veces.

**Los datos fiscales sin cargar no se muestran como filas vacías**, porque obligarían a revisar
cuáles están completas en lugar de leer y copiar de corrido.

**El texto de la factura omite los datos que faltan en vez de dejar el hueco.** Una factura que dice
"DNI:" sin número se ve peor que una que no lo menciona. Si el paciente tiene número de afiliado se
usa ese; si tiene los dos, se informan los dos (`src/lib/billing.ts`).

**Si hubo un aumento dentro del período facturado, no existe "valor de la sesión" como dato único**,
así que el texto detalla sesión por sesión para que el total cierre.

**El dinero se guarda en centavos, como entero.** Sumar decimales acumula error de redondeo:
`0.1 + 0.2` no da `0.3` en punto flotante. Todo el cálculo es entero y solo se formatea al
mostrarlo (`src/lib/money.ts`). El parser acepta tanto `1.500,50` como `1,500.50`, y al mostrar
se omiten los centavos cuando son cero: `$ 35.000`, no `$ 35.000,00`.

**Las fechas son `YYYY-MM-DD` en hora local, no timestamps UTC.** `new Date("2026-03-10")` se
interpreta como UTC y puede correr el día según la zona horaria; un turno del martes a las 15:00
tiene que seguir siendo el martes a las 15:00 (`src/lib/dates.ts`).

**El honorario se congela en cada sesión.** Se copia del paciente al agendar, pero después no se
toca: subir la tarifa no debe reescribir lo ya facturado.

**El cierre del día solo toca lo que está pendiente.** Las sesiones ya cerradas se muestran para
dar contexto, pero sin controles. Un pago no está atado a una sesión concreta —el saldo del paciente
es lo facturado menos lo pagado— así que volver a ofrecer "cobrar" sobre una sesión ya cerrada
registraría un cobro duplicado sin que se note (`src/lib/dayclose.ts`).

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
npm test          # 188 tests unitarios
npm run typecheck # TypeScript en modo strict
npm run build
```

```
src/
├── types.ts            Modelo de datos
├── lib/                money, dates, storage, pricing, recurrence, calendar,
│                       contact, palette, dayclose, billing — lógica pura
├── store/              reducer, selectores y contexto
├── components/ui.tsx   Card, Stat, Modal, Field
└── pages/              Dashboard, Patients, PatientDetail, Agenda, Finance, Settings
```

La lógica de negocio vive en `lib/` y `store/`, sin depender de React, y es la parte cubierta por
los tests. Los componentes solo muestran lo que esas funciones calculan.
