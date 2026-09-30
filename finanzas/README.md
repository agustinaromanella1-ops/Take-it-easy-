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
npm test             # 89 pruebas unitarias
npm run typecheck
npm run build        # compila en dist/ (HTML estático, sin servidor)
```

De punta a punta (35 verificaciones, con el lector de texto de verdad):

```bash
npm run build && npx vite preview --port 4174 &
node e2e/etapa1.mjs          # deja capturas en e2e/capturas/
node scripts/contraste.mjs   # contraste de todos los pares de colores
```

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

## Privacidad

Nada sale del dispositivo: sin servidor, sin cuentas, sin analítica. La compilación agrega una
política de contenido con `connect-src 'self'`, así que el navegador bloquea cualquier pedido a
otro origen aunque una dependencia lo intente. La prueba de punta a punta verifica que no haya
ninguno. El lector de texto y la tipografía se sirven desde la app.

El límite es el de cualquier app local: si se borran los datos del navegador o se pierde el
teléfono, se pierden. Por eso la copia está a un toque en Ajustes.

## Qué NO está (y no aparenta estar)

- Notificaciones del sistema: sin servidor no hay forma confiable. El `.ics` es lo que avisa con la
  app cerrada, y Ajustes lo dice.
- Voz: el dictado del navegador manda el audio a un tercero. Etapa 2, opcional y avisado.
- Capturas con varios movimientos, resúmenes de tarjeta enteros, importar archivos del banco.
- Lectura de comprobantes con IA (mejor en fotos difíciles): necesita un backend propio. No hay.
- Deudas con escenarios e inversión educativa.
- Compartir con otra persona, integraciones bancarias.

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

- `src/lib/finanzas/`: el motor (saldos, tarjeta, disponible, duplicados, pendientes, metas).
- `src/lib/texto/`: el analizador de frases y las categorías.
- `src/lib/comprobantes/`: extracción de campos (pura, probada) y el lector de texto.
- `src/lib/huellitas/`, `src/lib/hormiga.ts`, `src/lib/pausa.ts`: las reglas del juego y del regreso.
- `src/store/`: reducer (única entrada a los datos) y contexto con guardado, fusión entre pestañas
  y deshacer.
- `src/pages/`, `src/components/`: presentación.
