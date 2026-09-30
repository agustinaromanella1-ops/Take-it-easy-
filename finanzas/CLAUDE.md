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
node e2e/etapa3.mjs          # plan, inversión, compartir (levanta sus servidores)
node scripts/contraste.mjs   # si tocás un color
node scripts/iconos.mjs      # si cambia el perro de Pipí Cucú
```

## Reglas que no se adivinan leyendo el código

**El perro es el de Pipí Cucú, copiado, no redibujado.** `public/pipi-cucu-dog-flying.gif` y
`public/pipi-cucu-dog-static.png` son copias byte por byte de `../public/`: todas las apps tienen el
mismo perrito. No se dibuja uno "parecido", ni se recolorea, ni se recorta. Si cambia allá, se
copia de nuevo (`cp ../public/pipi-cucu-dog-* public/`) y se regeneran los íconos. Los trucos
mueven la imagen entera; `e2e/etapa1.mjs` verifica que los archivos sean idénticos.

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

**Privacidad**: nada de `fetch` a otros orígenes, analítica ni CDNs. El único `fetch` es a `/api/compartidos`, del mismo origen, y lleva solo bloques cifrados en el teléfono (ver `COMPARTIR.md`). El dictado lo hace el navegador, viene apagado y se avisa. La política de contenido de
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

**Compartir: la clave nunca sale del "#".** El servidor recibe solo el bloque cifrado y el hash del
token. Si agregás algo a la vista compartida (`lib/compartir/vista.ts`), que sea lo mínimo: nada de
notas, ids ni nombres de cuentas que no hagan falta. La vista se abre en `/ver` sin montar la app ni
tocar el almacenamiento de quien mira, y vuelve a leer si cambia el "#" (abrir otro enlace en la
misma pestaña no recarga la página).

**Inversión es educativa y no negocia eso.** Sin productos, sin tasas del mercado, sin
"recomendamos", sin botones para operar. Los números de ejemplo dicen que son ejemplo. Toda
simulación muestra el valor en pesos de hoy y el peor momento del camino.

**Nada de integraciones bancarias sin verificar** (ver `INTEGRACIONES.md`): cualquier fuente externa
entra por el flujo de revisión del importador, nunca escribe sola en los datos.

**`pkill -f` con un patrón que aparece en el mismo comando se mata a sí mismo.** Para liberar los
puertos de las pruebas, `fuser -k 4175/tcp`.
