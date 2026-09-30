# CLAUDE.md — Salchi (finanzas/)

App de plata para adultos con TDAH. Todo en español rioplatense: código, comentarios, commits y
textos. Es una app aparte de Pipí Cucú (la raíz del repo): no toques nada fuera de `finanzas/` y no
fusiones esta carpeta a `main` sin que se decida, porque `main` se publica solo.

El pedido completo y sus decisiones están en `../docs/prompt-app-finanzas-tdah.md`.

## Comandos

```bash
npm test                     # unitarias
npm run typecheck
npm run build && npx vite preview --port 4174 &
node e2e/etapa1.mjs          # punta a punta, con fecha fija y OCR real
node e2e/etapa2.mjs          # préstamos, importar, capturas, resumen, atajos
node scripts/contraste.mjs   # si tocás un color
node scripts/iconos.mjs      # si cambia el dibujo del perro
```

## Reglas que no se adivinan leyendo el código

**La plata es un entero de centavos**, siempre. `parseMoney`/`formatMoney` son la única frontera
con el texto. **Las fechas locales son `YYYY-MM-DD`**; nunca `new Date('2026-03-10')`.

**Cada término de "cuánto puedo usar" sale de un solo lugar** (`lib/finanzas/disponible.ts`). Las
cuotas viven solo en la tarjeta (`tarjeta.ts`), nunca como compromisos; lo apartado vive solo en
los aportes. Si agregás un concepto que resta, decidí de dónde sale y probá que no se descuente dos
veces.

**Tarjetas y préstamos son cuentas de deuda** (`esDeuda`): su saldo es lo que se debe, nunca plata
disponible, y pagarlas es `pago-tarjeta`, no gasto. Para filtrar "cuentas con plata" usá
`!esDeuda(c)`, no `!esTarjeta(c)`. Las cuotas de un préstamo se derivan (`prestamo.ts`), igual que
las de la tarjeta: no las guardes como compromisos.

**Un movimiento con fecha anterior a `fechaSaldo` no cambia el saldo** (se da por incluido en el
número que escribió la persona). Es a propósito para importar historial, pero cualquier cosa que
se agregue para corregir un saldo (un consumo del resumen, un ajuste) tiene que ir con fecha igual
o posterior. Ya se rompió una vez con el resumen de tarjeta.

**Los ingresos sin cobrar no suman nunca.** Van como proyección aparte, con "si".

**Nunca una cifra inventada.** Sin cuentas, `importe` es `null` y la pantalla dice qué falta. Un
compromiso sin importe no se estima. El extractor de comprobantes deja vacío lo que no encuentra.

**El reducer pone sellos y lápidas; quien despacha pone los ids.** Toda acción nueva que toque
datos lleva etiqueta en `etiquetaDe()` (hay una prueba que lo exige). Guardar siempre con
`guardarFusionando`. Deshacer resella y no quita trucos.

**Huellitas**: cada acción cuenta una vez por día, tope de dos huellas por día, nada se pierde por
inactividad. No premies cantidad de gastos, importes ni ahorro. Una acción de huellita tiene que
tener un botón real que la dispare.

**Regreso tras una pausa**: primero los compromisos vencidos, después los saldos. Al revés, marcar
un pago después de confirmar el saldo lo restaría dos veces. Las listas de cada paso se fijan al
entrar al paso.

**Privacidad**: nada de `fetch` a otros orígenes, analítica ni CDNs (la única excepción, el dictado, la hace el navegador, viene apagada y se avisa). La política de contenido de
`vite.config.ts` lo bloquea en la compilación, y `e2e/etapa1.mjs` lo verifica. El lector de texto
se sirve desde `public/ocr/`. Las imágenes de metas solo como `data:`.

**Textos**: voseo, mayúscula solo al principio, sin reproches ("olvidaste", "atrasado", "otra
vez"). El rojo es solo para errores; lo pendiente va en tono de aviso. El trato (femenino,
masculino, neutro) lo elige la persona; por defecto, neutro.

**Accesibilidad**: controles dentro de su `<label>` (`Field`), estados nunca solo por color (los
chips elegidos llevan ✓), foco inicial con `data-autofoco` en los cuadros, movimiento reducido con
`sinMovimiento()`.

**`'\;'` en JavaScript es `';'`.** El ICS necesita `'\\;'`; ya se rompió una vez acá también.

**En la prueba de punta a punta, el reloj avanza** desde la fecha fija (`setSystemTime`). Con
`setFixedTime` todos los sellos son iguales y la fusión elige la lápida en los empates.

**Un CSV de banco puede venir en latin1.** Se lee con `decodificar()`, no con `file.text()`.

**En Playwright, el nombre accesible de un campo incluye todo lo que hay dentro de su `<label>`**
(la ayuda, la opción elegida de un desplegable). Para esos, buscá por rol con una expresión o por
selector, no con `getByLabel` exacto.
