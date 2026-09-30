# Salchi

App de plata para adultos con TDAH. Anotás un gasto en dos toques, ves cuánto podés usar y qué
vence, y podés volver después de semanas sin que nada te reproche. Tiene un perro salchicha que
se puede apagar.

Es una herramienta de organización, no un tratamiento ni asesoramiento financiero. Las decisiones
de diseño parten de dificultades frecuentes con el TDAH y todavía hay que probarlas con personas
reales.

Vive en `finanzas/`, separada de Pipí Cucú (la app de la raíz del repositorio). No comparten
código en tiempo de ejecución: lo que se reutilizó se copió y adaptó.

## Cómo correrla

```bash
cd finanzas
npm install
npm run dev          # http://localhost:5173
npm test             # 134 pruebas unitarias (app y servidor)
npm run typecheck
npm run build        # compila en dist/ (HTML estático, sin servidor)
```

De punta a punta (35 + 19 + 14 verificaciones, con el lector de texto de verdad):

```bash
npm run build && npx vite preview --port 4174 &
node e2e/etapa1.mjs          # deja capturas en e2e/capturas/
node e2e/etapa2.mjs
node e2e/etapa3.mjs          # levanta solo sus dos servidores locales
node scripts/contraste.mjs   # contraste de todos los pares de colores
```

`node scripts/servidor-local.mjs` sirve la app compilada con el servicio para compartir en memoria,
como lo hace el Worker de Cloudflare. Ver `COMPARTIR.md`.

Playwright no es dependencia del proyecto. Si `import { chromium } from 'playwright'` falla:
`ln -s /opt/node22/lib/node_modules/playwright node_modules/playwright` (y `playwright-core`).

`npm run dev` y `npm run build` copian solos el lector de texto a `public/ocr/`
(`scripts/copiar-ocr.mjs`); esa carpeta no va al repositorio.

## Qué funciona (etapa 1)

Todo esto está implementado y probado; no hay botones que no hagan nada.

- **Primer uso**: arranca vacía. Tres pasos salteables: una cuenta, un compromiso, el perro.
- **Anotar**: número y Enter. La cuenta se elige sola si hay una sola, o la última usada. Sin
  cuenta también se puede: se resta igual y se avisa. Gasto, ingreso, entre mis cuentas, pago de
  tarjeta y devolución. Editar, borrar y deshacer todo. Aviso de posibles duplicados, sin borrar
  nada solo. Borradores que no se pierden al cerrar.
- **Anotar con una frase**: "gasté 8.500 en súper con débito", "2 lucas café efectivo", "zapatillas
  30000 en 3 cuotas con visa", "pasé 20000 de galicia a mp". Reglas propias, sin IA ni red. Muestra
  lo que entendió antes de guardar.
- **Comprobantes**: foto o captura, leída en el teléfono con Tesseract. Tickets, comprobantes de
  pago y de transferencia, facturas de servicios. Distingue total de subtotal y vuelto, saldo de
  gasto, factura (algo a pagar) de pago, transferencia de consumo, cuota de precio total y pago de
  resumen de compra. Marca lo dudoso y lo pregunta. Si no puede leer, lo dice y ofrece recortar,
  girar, sacar otra o completar a mano. La imagen no se guarda.
- **Cuánto puedo usar**: por moneda, hasta el próximo cobro o fin de mes, con la cuenta a la vista
  renglón por renglón y lo que falta saber. Los ingresos sin cobrar van aparte, con "si".
- **Tarjetas de crédito**: cuotas repartidas por resumen según cierre y vencimiento; pagar el
  resumen no duplica las compras.
- **Compromisos e ingresos esperados**, con recurrencia mensual e "importe a confirmar".
- **Metas y reserva**: una meta destacada, las demás plegadas. Apartar dentro de la app o registrar
  que la moviste a otra cuenta. Reserva con hitos propios y "cubre N meses" según tu estimación.
  Usar la reserva se presenta como su finalidad.
- **Volver después de una pausa** (7 días o más): sin reproches; pone al día lo que venció y los
  saldos, y registra la diferencia sin conciliar sin inventar movimientos.
- **Modo baja energía**: solo lo disponible, lo próximo que vence y anotar.
- **Salchi**: visible, de vez en cuando o sin personaje. Huellita de cinco almohadillas; al
  completarla aprende un truco (seis en total) que conserva para siempre. Tocarlo repite el último.
  Con movimiento reducido, quieto.
- **Hormiguita** opcional, como mucho una vez cada 3 días y nunca durante una tarea.
- **Calendario**: cada compromiso se puede bajar como `.ics` con recordatorio. Por defecto dice solo
  "Vence un pago".
- **Tus datos**: copia en JSON, movimientos en CSV para planilla, traer una copia, borrar todo.
- **Datos de ejemplo** separados: no se guardan ni se mezclan con los tuyos.
- **PWA instalable**, funciona sin conexión, con barra de "hay una versión nueva".

## Qué suma la etapa 2

- **Préstamos**: se cargan como deuda (como la tarjeta), con cuota, día de vencimiento, cuotas que
  quedan y tasa opcional. Las cuotas se derivan, no se guardan como compromisos, así que entran una
  sola vez en "cuánto puedo usar" y en lo que vence. Pagar la cuota baja la deuda y no es gasto.
- **Escenarios de deuda** (Mis planes → Deudas): "si pago tanto por mes, termino en N meses y pago
  tanto de intereses", con los supuestos escritos. Si el pago no cubre los intereses, lo dice. No
  recomienda nada.
- **Importar un CSV** del banco o la billetera: detecta separador, codificación (UTF-8 o latin1),
  columnas (importe con signo, o débito y crédito) y fechas. Nunca usa la columna de saldo. Lo
  repetido viene destildado, todo entra "para revisar", y deshacer se lleva la importación entera.
- **Capturas con varios movimientos** (la actividad de una billetera): cada uno con su fecha y
  signo; los saldos se ignoran; lo que vino sin signo se pregunta.
- **Resumen de tarjeta**: pegando el texto del PDF o con una foto. Compara el saldo del resumen con
  lo anotado al cierre y muestra de dónde sale la diferencia: consumos que faltan (una cuota 2 de 6
  se agrega como las 5 que quedan), intereses e impuestos, y lo que sobre como diferencia sin
  conciliar. Nada se agrega sin elegirlo.
- **Compras en cuotas** por tarjeta: qué cuota viene y cuánto falta que venza.
- **Recordatorios**: todos los vencimientos al calendario en un solo archivo, y un recordatorio que
  se repite ("Mirar Salchi") el día y la hora que elijas. Sin importes en el texto.
- **Accesos rápidos**: mantener apretado el ícono ofrece Anotar, Leer un comprobante y Lo que
  vence. "Compartir" un texto hacia Salchi (el aviso del banco) abre Anotar con esa frase entendida.
- **Dictado por voz**, apagado por defecto: el navegador puede mandar el audio afuera y Ajustes lo
  dice antes de prenderlo.
- **Ocho trucos**, y los aprendidos se pueden volver a ver desde Ajustes.

## Qué suma la etapa 3

- **Plan del mes** (Mis planes): lo cobrado y lo esperado, lo que vence (compromisos, resúmenes y
  cuotas de préstamos) y el día a día (el promedio de lo anotado, redondeado, o un número que
  escribís). El margen que queda, con los supuestos a la vista. Es un plan: no mueve plata.
- **Cuándo se llega a una meta** al ritmo real de los aportes de los últimos tres meses. Sin
  aportes, no hay pronóstico.
- **Aprender sobre inversión**: preguntas para pensar antes (la reserva, las deudas caras, el
  plazo, qué harías ante una caída), un simulador con escenarios que incluyen pérdidas, el valor en
  pesos de hoy y el peor momento del camino, y un glosario con señales de estafa. Sin productos,
  sin tasas del mercado, sin recomendaciones, sin operar.
- **Compartir con alguien de confianza**: vos elegís qué ve (lo disponible, lo que vence, las metas,
  los movimientos), de solo lectura. Va cifrado desde el teléfono y el servidor no puede leerlo;
  "Mostrarle lo de hoy" lo actualiza, "Dejar de compartir" lo corta, y vence solo a los 30 días.
  Necesita el Worker con su almacenamiento (`COMPARTIR.md`); si no está, la app lo dice.
- **Integraciones bancarias**: no hay, a propósito. `INTEGRACIONES.md` explica por qué y qué
  habría que verificar antes de sumar una.
- **Política de privacidad** en `/privacidad.html`, enlazada desde Ajustes.

## Privacidad

Nada sale del dispositivo: sin servidor, sin cuentas, sin analítica. La única excepción es el
dictado por voz y compartir con alguien, que vienen apagados y avisan antes. Lo compartido viaja
cifrado y el servidor no puede leerlo. La compilación agrega una
política de contenido con `connect-src 'self'`, así que el navegador bloquea cualquier pedido a
otro origen aunque una dependencia lo intente. La prueba de punta a punta verifica que no haya
ninguno. El lector de texto y la tipografía se sirven desde la app.

El límite es el de cualquier app local: si se borran los datos del navegador o se pierde el
teléfono, se pierden. Por eso la copia está a un toque en Ajustes.

## Qué NO está (y no aparenta estar)

- Notificaciones del sistema: sin servidor que las mande no hay forma confiable. El calendario es
  lo que avisa con la app cerrada, y Ajustes lo dice.
- Conexión con bancos: ver `INTEGRACIONES.md`.
- Sincronizar entre dispositivos propios: compartir es de solo lectura, no una copia viva.
- Compartir una imagen hacia la app; resúmenes en PDF leídos directo (se pega el texto).
- Intereses calculados solos en préstamos y tarjetas: el saldo real lo da el banco.
- Límite de pedidos por IP en el servicio para compartir: se configura en Cloudflare antes de
  abrirlo a mucha gente.

## Contraste

Medido con `node scripts/contraste.mjs` sobre los tokens de `src/styles.css`. Algunos valores:

| Par | Claro | Oscuro |
|---|---|---|
| Texto sobre fondo | 14,05:1 | 15,78:1 |
| Texto suave sobre fondo | 6,86:1 | 9,58:1 |
| Verde sobre menta (el número de "podés usar") | 4,53:1 | 6,45:1 |
| Texto sobre botón verde | 5,29:1 | 9,35:1 |
| Aviso | 7,82:1 | 10,03:1 |

## Estructura

- `src/lib/finanzas/`: el motor (saldos, tarjeta, préstamo, disponible, duplicados, pendientes, metas, escenarios).
- `src/lib/importar/`: el importador de CSV.
- `src/lib/compartir/` y `server/`: cifrado, vista compartida y el servicio (Worker).
- `src/lib/texto/`: el analizador de frases y las categorías.
- `src/lib/comprobantes/`: extracción de campos (pura, probada) y el lector de texto.
- `src/lib/huellitas/`, `src/lib/hormiga.ts`, `src/lib/pausa.ts`: las reglas del juego y del regreso.
- `src/store/`: reducer (única entrada a los datos) y contexto con guardado, fusión entre pestañas
  y deshacer.
- `src/pages/`, `src/components/`: presentación.
