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

**Cierre del día.** Al terminar la jornada, un botón —en el inicio para las de hoy, en la agenda
para el día que se esté mirando— abre el repaso de las sesiones
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

## Pantalla de bienvenida

Al abrir, la app muestra el logo por 1,6 segundos y se puede saltear tocándolo. Usa el archivo real
del logo, optimizado de 1,1 MB a 15 KB, y entra en la precarga del service worker, así aparece
también sin conexión. El fondo de la pantalla es el color muestreado del propio archivo: si no
coincidiera, se vería el borde de la imagen.

Dura poco a propósito. Una animación que se interpone entre la persona y lo que vino a hacer deja de
ser encanto y pasa a ser una demora, y esta app se abre varias veces por día.

## Estética

Serif de display (Playfair Display) para títulos y cifras principales, sans redondeada (Nunito)
para el cuerpo. Los títulos de sección van fuera de la tarjeta, con su acción a la derecha.

**Atardecer.** El fondo va de celeste (#d9ebfb) a lila (#e9dff7) a durazno (#ffe3d2), como un cielo
al caer la tarde. Los acentos salen de ahí: naranja para la acción, lila para lo seleccionado,
amarillo para el guiño, menta y rosa para los estados.

**Todo se dibuja con tinta.** Contornos de 2,5px, sombra dura sin desenfoque y esquinas muy
redondeadas: las tarjetas se leen como calcomanías pegadas sobre la página en vez de flotando
encima. La tinta (`--ink`, #1f1e47) es la misma de la portada —contornos, títulos y sombras salen
todos de ahí—, y eso es lo que hace que la app y la bienvenida se lean como una sola cosa. Al
apretar, un botón baja hasta donde estaba su sombra, que es lo que hace un botón de verdad.

**Los pares de color están medidos, no elegidos a ojo.** Todos pasan WCAG AA (4,5:1): tinta sobre
blanco 15,7:1, cuerpo sobre blanco 9,1:1, apagado sobre el degradé 5,1:1, `--naranja-ink` (#a63508)
sobre blanco 6,7:1. El caso que obligó a decidir: blanco sobre el naranja del botón da 2,7:1 y no
pasa, así que el botón principal lleva **tinta sobre naranja** (5,9:1), que además es lo que pide
el estilo.

**Los colores de los gráficos se validaron aparte.** Violeta #7b52ab para lo cobrado y naranja
#e0642b para lo pendiente: ΔE 23,6 en protanopía y 23,7 en tritanopía, muy por encima del piso de
8, así que se distinguen con cualquier tipo de daltonismo. El gris #8b84a0 de "canceladas" no llega
al piso de saturación a propósito: es el estado sin consecuencias y tiene que leerse apagado.

**El naranja es acción, no jerarquía.** Lila es lo seleccionado, el naranja de los gráficos es
"pendiente", y el naranja de los botones es "tocá acá". Si el mismo color marcara además lo
importante, tendría dos significados.

**Los degradés van sobre superficies grandes y tranquilas** —el héroe, el cierre del día, el
ícono— y nunca sobre marcas de datos, donde el color significa algo y un degradé lo volvería
ambiguo.

**El pie con el perrito** cierra todas las secciones. Es el mismo perro de la portada —el dibujo
aprobado, sin redibujar— y ahí está quieto y callado: es el primer fotograma, sin mensaje. Al
tocarlo sale un mensaje —de diecinueve, y nunca el mismo dos veces seguidas— y vuela un par de
segundos. Arranca callado a propósito: si el mensaje ya
estuviera ahí, dejaría de ser un hallazgo y sería un cartel más compitiendo por la atención justo
cuando entrás a ver tus números.

**Modo oscuro.** No es el claro con los colores dados vuelta: es el mismo atardecer un rato más
tarde. Los fondos son noche con un resto de ciruela, el contorno pasa de tinta a lila claro —sobre
oscuro, una línea oscura no se ve— y los acentos se levantan lo justo para seguir pasando el
contraste. Todos los pares están medidos, y los gráficos tienen su propio juego validado para ese
fondo (ΔE 22,3 en protanopía). Los colores de los gráficos viven en el CSS y no en el JavaScript,
porque una constante no se entera de que cambió el tema. El tema se pinta en un script del
`index.html` antes del primer dibujado: si esperara al JavaScript de la app, la pantalla arrancaría
en claro y saltaría a oscuro de golpe.

**La portada saluda en cada arranque.** La primera vez se queda hasta que la toquen, que es cuando
hay algo para leer; de ahí en más se va sola a los 1,7 segundos y tocar en cualquier lado la
saltea. Es un saludo, no una puerta: una app de trabajo se abre varias veces por día y lo que al
principio es encanto se vuelve una demora.

**La despedida del cierre del día.** Cerrar la jornada termina con un resumen —a cuántas personas
atendiste, quiénes, cuánto facturaste— y no devolviendo a la pantalla de números. Es la única
pantalla sin color de toda la app: el día se terminó y la app baja la voz.

**Mensajes de WhatsApp.** Cada turno agendado de alguien con teléfono cargado tiene un botón que
abre WhatsApp con el mensaje ya escrito: recordar, pedir confirmación o reprogramar. Son borradores,
no envíos: WhatsApp los deja en el campo de texto y salen recién si la persona toca enviar. Un
mensaje a un paciente no se despacha solo.

**La guía y los carteles.** El signo de pregunta de la barra de arriba abre la guía de uso, escrita
para leerse de un tirón la primera vez y consultarse suelta después. Aparte, la primera vez que se
entra salen cinco carteles que señalan los botones de verdad —los busca por `data-tour` y mide dónde
están, así el mismo paso sirve para la barra de abajo del celular y la de arriba de la computadora—.
Se pueden saltear en cualquier momento, no vuelven solos, y se piden de nuevo desde la guía.

**`prefers-reduced-motion` anula todo el movimiento**, incluido el vuelo del perro: cambia el
mensaje pero la imagen no se toca. Para varias personas el movimiento no es adorno sino una distracción que compite con lo
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

## Sacar los datos afuera

Hay dos salidas y hacen cosas distintas, así que conviene no confundirlas:

- **Copia de seguridad (`.json`)** — es la única que la app puede volver a importar. Sirve para
  recuperar todo tal cual estaba. No se abre en Excel.
- **Planillas (`.csv`)** — sesiones y cobros, para hacer números, pasarle algo al contador o
  guardar el año cerrado. No sirven para restaurar.

Las planillas están pensadas para Excel en español, que es donde esto suele romperse: separador
`;` (con comas, Excel mete todo en una columna), decimales con coma (si no, los toma como texto y
no los suma), BOM al principio (sin él lee el archivo como Latin-1 y "sesión" sale "sesiÃ³n"), y
fechas con el año completo, porque una planilla se guarda y se mira el año que viene.

## Que recargar adentro de la app no dé 404

La app es de una sola página: el navegador pide `/agenda` y en el servidor ese archivo no existe.
Hay que decirle a la plataforma que responda con el index, y **cada una lo pide a su manera**:

- **Cloudflare Workers** → `not_found_handling: "single-page-application"` en `wrangler.jsonc`.
- **Netlify** → la regla de redirección en `netlify.toml`.

Lo que no se puede es pedirlo por los dos caminos a la vez. Había además un `public/_redirects`
con `/* -> /index.html 200`, y Cloudflare rechaza el despliegue entero: ve esa regla junto al
`not_found_handling` y la reporta como bucle infinito. Ese archivo ya no está.

## Privacidad

`public/privacidad.html` es una página suelta, no una pantalla de la app: Google Play pide una
dirección pública que se pueda abrir sin instalar nada. Se publica en `/privacidad.html` y se
enlaza desde Ajustes.

Lo que dice es verificable en el código: no hay una sola llamada de red (`fetch`, `XMLHttpRequest`,
websockets), no hay analítica ni rastreadores, las tipografías están alojadas acá y el `index.html`
no pide nada a dominios externos. El único enlace a un tercero es `wa.me`, y lo abre la persona
tocando un botón. Antes de tocar esa página, conviene volver a correr esa comprobación.

## Cuando se publica una versión nueva

El service worker guarda la app entera para que ande sin conexión, y eso tiene una contracara: sin
avisar, el navegador sigue sirviendo la versión que ya tenía. Cuando hay una nueva, la app muestra
una barra amarilla arriba —"Hay una versión nueva"— con un botón para aplicarla.

Antes esto intentaba ser astuto: aplicaba la versión nueva sola, pero solo cuando la app pasaba a
segundo plano, para no interrumpir a nadie en medio de cargar una sesión. El problema es que nadie
puede adivinar esa regla: si no salías y volvías, te quedabas en la versión vieja sin ninguna señal
de que había otra. Actualizar tiene que ser algo que se ve y se decide.

Para forzar la versión nueva a mano —por ejemplo, para comprobar que un cambio se publicó— alcanza
con abrir el sitio en una ventana de incógnito, que no usa el service worker.

## Dónde viven los datos

Todo se guarda en el navegador (`localStorage`), en esta computadora. No hay servidor ni cuenta:
nada se envía a ningún lado. Como contrapartida, **limpiar la caché o cambiar de computadora
borra el historial**, así que conviene exportar una copia desde Ajustes cada tanto.

## Desarrollo

```bash
npm test          # 188 tests unitarios
npm run typecheck # TypeScript en modo strict
npm run build

# Prueba de aceptación: carga datos por la interfaz real y comprueba que
# sobrevivan a una recarga, a exportar/borrar/importar y a estar sin conexión.
npx vite preview --port 4173 &
npm run test:e2e
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
