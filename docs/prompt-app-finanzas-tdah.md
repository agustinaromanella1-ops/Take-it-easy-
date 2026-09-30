# Prompt: app de plata para adultos con TDAH

> Versión mejorada del pedido original. Lo que cambió respecto de ese texto y por qué está al
> final, en «Notas sobre esta versión». Lo que figura como **[decidido]** ya no se discute: se
> construye así. Lo que figura como **[a confirmar]** tiene un valor por defecto que se usa si
> nadie dice otra cosa.

---

## 0. Contexto: dónde se construye

Este repositorio ya tiene una app publicada, **Pipí Cucú** (agenda y honorarios para consultorio
psicológico). Cada commit a `main` se publica solo en Cloudflare, y hay una versión para Google
Play en preparación. **La app nueva no puede romper ni mezclarse con esa.**

- **[a confirmar] Dónde vive.** Por defecto: un repositorio nuevo, con la misma base técnica.
  Mientras no exista, se trabaja en una rama que nunca se fusiona con `main`, en una carpeta
  `finanzas/` con su propio `package.json`, y no se toca nada fuera de ella.
- **[a confirmar] Nombre.** Por defecto, uno provisional (`Salchi`) fácil de reemplazar desde
  una sola constante.
- **[decidido] Se reutiliza lo que ya está probado en Pipí Cucú**, copiándolo y adaptándolo, no
  reinventándolo. Leé su `CLAUDE.md` antes de empezar: casi todas sus reglas valen igual acá.
  - `src/lib/money.ts`: plata en centavos enteros, `parseMoney` / `formatMoney` como única
    frontera con el texto.
  - `src/lib/dates.ts`: fechas locales como `YYYY-MM-DD`, nunca `new Date('2026-03-10')`.
  - `src/lib/storage.ts`, `fusion.ts`, `deshacer.ts`: validar campo por campo lo que vuelve del
    almacenamiento, sello `updatedAt` y lápidas puestos por el reducer, fusión registro por
    registro entre pestañas, deshacer que vuelve a sellar.
  - `src/lib/useBorrador.ts` + `AvisoBorrador`: lo escrito no se pierde al cerrar una pantalla.
  - `src/pwa.ts` + `vite.config.ts` + `public/_headers`: barra de «hay una versión nueva» (las
    tres piezas).
  - `src/lib/movimiento.ts`, `src/lib/tema.ts`: una sola respuesta para movimiento reducido y
    tema claro/oscuro.
  - `Field` de `ui.tsx` (el control va adentro de su `<label>`) y la regla de contraste AA.
  - El perro: `public/pipi-cucu-dog-flying.gif` y `public/pipi-cucu-dog-static.png` son la
    referencia visual del salchicha (ver §8).

## 1. Qué es y para quién

Una app para adultos de Argentina con TDAH a quienes les cuesta muchísimo administrar la plata.
No es un tratamiento ni está validada clínicamente, y no se presenta así: las decisiones de diseño
parten de dificultades frecuentes (memoria de trabajo, arranque de tareas, evitación por
vergüenza, abandono y regreso) y hay que validarlas con personas reales. No todas las personas
con TDAH quieren lo mismo: todo lo lúdico se puede apagar.

**Criterio final.** Todo se construye alrededor de cinco situaciones. Si una función no ayuda a
ninguna, va a una etapa posterior.

1. **Anotar un gasto con muy poco esfuerzo**: desde cualquier pantalla, en dos toques y un
   número. Sin categoría ni cuenta obligatorias.
2. **Entender cuánto puedo usar y hasta dónde llega esa cifra**: un número con período, fecha de
   actualización, lo que falta saber y el cálculo a la vista.
3. **Saber cuál es el próximo compromiso**: uno solo, con su botón.
4. **Volver después de semanas sin sentirse castigada**: sin reproches, sin rachas perdidas, con
   un camino corto para poner la situación al día.
5. **Disfrutar al salchicha si gusta, y usar la app entera sin él si no.**

**Principios** (en orden de prioridad cuando chocan):

1. Menos esfuerzo, menos memoria, menos decisiones a la vez.
2. Cálculos confiables, determinísticos y explicables. Ninguna cifra tranquilizadora inventada.
3. Utilidad desde el primer uso, con datos incompletos marcados como tales.
4. Volver sin vergüenza.
5. Diversión opcional, nunca castigos.
6. Bienestar financiero antes que tiempo dentro de la app.

## 2. Idioma y localización

- Español rioplatense con voseo, cálido y adulto. Mayúscula solo en la primera letra.
- **Palabras que no aparecen nunca:** «mal gasto», «fracasaste», «te portaste mal», «deberías»,
  «otra vez», «olvidaste», «atrasada» aplicada a la persona. El rojo es para errores de la app,
  no para cosas sin hacer ni para déficits (esos van en tono de advertencia, con texto).
- Pesos argentinos por defecto. Dólares en cuentas separadas.
- Números con formato `es-AR` (`$ 8.500,00`, `US$ 120`). Fechas en texto («viernes 3 de
  octubre»), y la distancia de tiempo («en 4 días») más grande que la fecha.
- Efectivo, cuentas bancarias, billeteras virtuales, tarjetas de débito y de crédito.
- Ingresos fijos y variables; compras en cuotas.

## 3. Sistema visual

- Paleta de partida (ajustable, pero cada par texto/fondo se mide contra WCAG AA 4,5:1 y se
  anota el número): verde profundo `#0F7A5F`, crema `#FBF8F4`, menta `#DCF3E4`, y un acento cálido
  discreto para celebraciones. Todo color es un token en `:root` con su par en modo oscuro.
- Tarjetas redondeadas, aire, tipografía grande y muy legible. Nada de planilla.
- **Una acción principal por pantalla.** Detalles e informes plegados (expansión progresiva).
- Íconos siempre con etiqueta. Ningún estado se comunica solo con color.
- Teléfono primero (360 px de ancho como referencia). En escritorio se centra y se ensancha un
  poco; no se llena de gráficos.
- Movimiento reducido (sistema o Ajustes), teclado completo, lector de pantalla. Los controles no
  cambian de lugar según el estado: si algo no aplica, se deshabilita con explicación o no
  aparece, pero lo fijo queda fijo.

## 4. Navegación

- Tres secciones abajo: **Hoy**, **Mi plata**, **Mis planes**.
- **Botón permanente «Anotar»**, en el mismo lugar en las tres, que abre el registro rápido.
- **Ajustes** desde un ícono con etiqueta arriba, sin competir con lo principal.
- Sin router: la navegación es estado, como en Pipí Cucú, salvo que haya una razón concreta.

## 5. Motor financiero (lo que tiene que estar bien sí o sí)

Todo esto vive en `src/lib/` como funciones puras con pruebas. La interfaz no calcula.

### 5.1 Modelo de datos mínimo

- **Cuenta**: nombre, tipo (`efectivo | banco | billetera | tarjeta-credito`), moneda (`ARS |
  USD`), saldo inicial con fecha, `cuentaLiquida` (sí por defecto salvo tarjeta de crédito). La
  tarjeta de crédito tiene además día de cierre y día de vencimiento.
- **Movimiento**: tipo, importe en centavos (siempre positivo; el signo lo da el tipo), moneda,
  fecha, cuenta (o `null` = pendiente de asignar), cuenta destino (transferencias y pagos de
  tarjeta), categoría opcional, nota opcional, `origen` (`manual | texto | voz | comprobante |
  ajuste`), `estadoRevision` (`confirmado | a-revisar`), referencia al comprobante si lo hay, y
  referencia al movimiento original en las devoluciones.
- **Tipos de movimiento**: `gasto`, `ingreso`, `transferencia` (entre cuentas propias),
  `devolucion`, `pago-tarjeta`, `ajuste` (diferencia sin conciliar).
- **Compromiso**: nombre, importe (o «importe a confirmar»), moneda, vencimiento, recurrencia
  opcional, estado (`pendiente | pagado`), y si viene de una compra en cuotas, cuota N de M.
- **Ingreso esperado**: importe estimado o rango, fecha probable, fijo o variable. Nunca cuenta
  como disponible hasta que se registra como ingreso.
- **Meta** y **reserva de seguridad**: ver §10.
- **Asignación**: plata de una cuenta apartada para una meta dentro de la app (virtual), o
  movida de verdad a otra cuenta (entonces es una transferencia). Se distinguen siempre.
- Cada registro lleva `id`, `updatedAt`; borrar deja lápida (id + fecha, nunca contenido).

### 5.2 Reglas contables

- **Transferir entre cuentas propias no es gastar**: resta de una, suma a la otra, no afecta el
  disponible total.
- **Tarjeta de crédito**: la compra es el gasto (cuando se hace) y aumenta la deuda de la
  tarjeta. **Pagar el resumen es un `pago-tarjeta`**: baja el saldo de la cuenta y la deuda de la
  tarjeta, y no es un gasto nuevo. Así no se cuenta dos veces.
- **Cuotas**: una compra en N cuotas genera N compromisos futuros sobre la tarjeta; el gasto del
  mes es la cuota, no el total. El total se muestra aparte como «te quedan $X en N cuotas».
- **Reservar para una meta no es gastar.** Usar la reserva para lo que era tampoco es fracasar.
- **Devolución**: queda vinculada al gasto original y lo compensa; no se edita el original.
- **Monedas separadas siempre.** No se suman pesos y dólares. Si alguna vez se muestra una
  conversión, lleva tipo de cambio, fuente y fecha, cargados por la persona; la app no busca
  cotizaciones.
- **Duplicados**: mismo importe, misma moneda, fecha a ±2 días y comercio parecido → se avisa y
  se pregunta. Nunca se borra solo.
- Todo se edita, se borra y se deshace (con el `dispatch` que guarda el estado anterior).

### 5.3 Disponibilidad: la fórmula

Período por defecto: **hasta el próximo ingreso esperado**, o hasta fin de mes si no hay ninguno
cargado. La persona puede elegir otro. Siempre se muestra.

```
disponible (por moneda) =
    Σ saldo de cuentas líquidas en esa moneda          (confirmado, con fecha de actualización)
  − Σ compromisos pendientes que vencen en el período  (sin los ya cubiertos por una asignación)
  − deuda de tarjeta que vence en el período           (una sola vez: si la cuota ya es un
                                                        compromiso, no se vuelve a restar)
  − Σ asignaciones virtuales a metas y reserva
```

- Los gastos pendientes de asignar a una cuenta **se restan igual** (ya salió la plata de algún
  lado) y se marca «hay N gastos sin cuenta: el número puede no coincidir con tus saldos».
- Los ingresos esperados **no suman**: se muestran aparte como «si cobrás lo esperado, llegarías
  a $X», con la palabra *si*.
- Un compromiso con «importe a confirmar» no se inventa: el número lleva el aviso «falta el
  importe de Luz».
- **Faltantes que se muestran en vez de una cifra**: sin cuentas → «Para calcular, necesito saber
  cuánto tenés hoy»; saldos de hace más de 7 días → el número con «actualizado hace 12 días».
- **Déficit**: se muestra el número negativo, sin rojo, con texto neutral («Con lo que sabemos,
  faltan $X para cubrir lo que vence hasta el 10») y dos salidas: revisar compromisos o
  actualizar saldos.
- Botón «¿Cómo se calcula?» que despliega exactamente la cuenta de arriba con los importes
  reales, renglón por renglón.

## 6. Pantallas

### Hoy

Responde en este orden, de arriba abajo, y nada más:

1. **Cuánto puedo usar**: el número grande, el período, la fecha de actualización, los faltantes.
2. **El próximo compromiso**: uno, con «en 3 días» grande, y su botón («Ya lo pagué» / «Ver»).
3. **Un paso chiquito sugerido** (de una lista determinística: actualizar un saldo viejo,
   asignar un gasto sin cuenta, confirmar un importe a confirmar, revisar un comprobante).
4. **La meta destacada**, si hay, con lo reservado de verdad.
5. **El salchicha y la huellita**, si están activados.

**Modo baja energía** (un interruptor visible en Hoy, recordado): solo disponible, próximo
compromiso y «Anotar».

### Mi plata

Cuentas con saldos por moneda, movimientos (con filtro por cuenta y por «a revisar»),
compromisos, tarjetas con su resumen y cuotas, deudas.

### Mis planes

Metas (una destacada, las otras plegadas), reserva de seguridad, y en etapa 3 inversión
educativa.

### Primer uso

Arranca **vacía de verdad**. Onboarding de tres pasos como máximo, todos salteables:
1. «¿Cuánta plata tenés hoy y dónde?» (una cuenta alcanza; «no sé exacto» vale y queda marcado
   como aproximado).
2. «¿Hay algo que tengas que pagar pronto?» (uno alcanza).
3. «¿Querés que te acompañe un salchicha?» (visible / de vez en cuando / sin personaje).

Datos de demostración: **solo** desde un botón «Ver con datos de ejemplo», con una franja fija
que diga «Estás mirando datos de ejemplo» y un botón para salir que los borra por completo. Nunca
se mezclan con los reales.

## 7. Anotar movimientos

- **Rápido**: se abre con el teclado numérico listo. Importe → «Guardar». Todo lo demás es
  opcional y está plegado. Si no hay cuenta, queda pendiente de asignar y se explica en una línea.
- **Texto natural, con un analizador determinístico propio (sin IA)**: «Gasté 8.500 en súper
  con débito», «cobré 120 lucas», «2 lucas café efectivo», «uber 4500 mp». Extrae importe
  (incluye «lucas», «k», «mil»), tipo, medio de pago contra los nombres y alias de las cuentas,
  comercio y categoría por palabras clave. Siempre muestra lo que entendió antes de guardar, y lo
  que no entendió queda vacío, no adivinado. Con pruebas unitarias con decenas de frases reales.
- **Voz**: **[decidido]** va en etapa 2 y opcional, porque el reconocimiento de voz de Chrome
  manda el audio a servidores de Google, lo que contradice «nada sale del dispositivo». Cuando se
  haga, se avisa eso antes de activarlo y el resultado pasa por el mismo analizador de texto.
- **Foto o captura**: ver §7 bis.
- Importar archivos (CSV de bancos): etapa 2.

### 7 bis. Comprobantes: la función prioritaria

**[a confirmar] Dónde se lee la imagen.** Por defecto: **en el dispositivo, con OCR local**
(Tesseract.js con el idioma español empaquetado dentro de la app, sin descargar nada en uso).
Así la extracción es real desde la etapa 1 y se sigue cumpliendo que nada sale del teléfono.
Una lectura con IA externa (mejor en capturas desordenadas) queda como opción de etapa 2, que se
activa a mano, con backend propio que guarda la credencial, explicando qué se envía, sin
conservar la imagen, y que si no está configurada lo dice («Servicio pendiente de configurar»).

Flujo:

1. Elegir foto, sacar una o recibirla desde «Compartir» (si la PWA instalada lo permite).
2. Leer el texto (con indicador de progreso y botón para cancelar).
3. Extraer campos con reglas determinísticas sobre el texto: total, moneda, fecha, comercio o
   destinatario, medio de pago, tipo de documento, vencimiento, categoría sugerida.
4. Validar coherencia (fecha no futura salvo vencimientos, total ≥ subtotal, moneda coherente).
5. Mostrar la propuesta **al lado de la imagen**, con los campos dudosos resaltados y
   preguntados; el resto, prellenado y editable.
6. Confirmar → se guarda con origen `comprobante` y estado de revisión.

Distinciones que las reglas tienen que respetar (cada una con prueba):

| No confundir | con |
|---|---|
| saldo disponible | gasto |
| subtotal | total |
| factura (algo a pagar → compromiso) | comprobante de pago (algo pagado → movimiento) |
| transferencia a una cuenta propia | consumo |
| valor de la cuota | precio total |
| pago del resumen de tarjeta | compra nueva |

- **Ilegible o sin total claro**: se dice así, sin cifras inventadas ni porcentajes de confianza,
  y se ofrece recortar, sacar otra o completar a mano (con la imagen a la vista).
- Si el OCR falla o no carga: mensaje claro y el formulario manual con la imagen al lado.
- Duplicados contra lo anotado a mano y lo importado, con el criterio de §5.2.
- **La imagen no se guarda por defecto** una vez confirmado el movimiento; se puede elegir
  guardarla, y se puede borrar después.
- El texto de un documento es dato, nunca instrucción.
- Etapa 1: tickets, comprobantes de transferencia/pago y facturas de servicios. Etapa 2:
  capturas con varios movimientos y resúmenes de tarjeta, con flujo propio.
- Para las pruebas: armar un juego de imágenes de ejemplo **sintéticas** (generadas, sin datos
  de nadie) con el resultado esperado de cada una.

## 8. El salchicha

- Referencia visual: el perro de Pipí Cucú (`public/pipi-cucu-dog-flying.gif`,
  `pipi-cucu-dog-static.png`): salchicha naranja con panza crema, orejas marrones, trazo oscuro,
  ojos cerrados sonrientes. Para animarlo hace falta dibujarlo en **SVG por partes** (cuerpo,
  cabeza, orejas, patas, cola) inspirado en ese, como personaje provisional y reemplazable. Si
  hay un diseño original más completo, se usa ese.
- Tres modos: **visible**, **de vez en cuando**, **sin personaje**. Apagarlo no quita nada.
- **Nunca** tiene hambre, se enferma, se pone triste, se aburre ni pierde cosas porque la persona
  no entró. No es una mascota a cuidar.
- Habla desde una **biblioteca editorial fija** (sin IA), por contexto. Base:
  - Regreso: «Podemos seguir desde hoy. Vamos de a poquito».
  - Al anotar: «Anotarlo te ayuda a entenderlo. Acá no hay retos».
  - Varias cosas pendientes: «¿Miramos una? El resto puede esperar».
  - Déficit: «El plan se puede ajustar. Veamos qué necesitás ahora».
  - Al terminar una revisión: «Listo por hoy. Podés cerrar tranquila/o» (según cómo prefiera que
    la traten, elegido en Ajustes; por defecto una forma neutra: «Listo por hoy. Ya podés
    cerrar»).
  - Al usar la reserva: «La preparaste para ayudarte en momentos así».
- No felicita decisiones de gasto o ahorro. Reconoce revisar, anotar, aclarar y retomar.

## 9. Huellitas y trucos

- **Qué es**: una huella de cinco almohadillas. Cada acción útil llena una. Al completarse, el
  salchicha hace un truco y la huella vuelve a empezar.
- **Acciones que cuentan**, cada una **como máximo una vez por día**:
  revisar los movimientos a revisar (vaciar la lista o marcar «revisado»), confirmar o pagar un
  compromiso, actualizar el saldo de una cuenta, completar la revisión breve, volver después de
  una pausa (una vez por pausa), procesar un comprobante.
- **No cuentan**: la cantidad de gastos anotados, los importes, lo ahorrado. Anotar un gasto
  cuenta como mucho una vez por día, y borrar lo recién anotado no da nada. Tope: dos huellitas
  completas por día.
- **Huellitas y plata no se mezclan.** Nunca se muestra una meta como avanzada por huellitas.
- **Trucos**: patita, giro, panza arriba, pelota, reverencia, saltito con cola. Se desbloquean
  en ese orden y **quedan para siempre**. Sin rachas, sin vencimientos, sin perder nada.
- **Primera celebración** (etapa 1): el perro entra, apoya la patita sobre la huella para
  completarla y da un giro corto.
- Animación de 2 a 3 segundos, que no bloquea, no roba el foco y anuncia el logro con
  `aria-live="polite"`. Sin sonido por defecto. Tocando al perro se repite. Se puede apagar
  («Celebraciones»). Con movimiento reducido: imagen fija del perro con la huella completa.

## 10. Metas, reserva de seguridad, deudas e inversión

- **Meta**: nombre, imagen opcional (queda en el dispositivo), importe objetivo, moneda, fecha
  flexible (o ninguna), plata reservada de verdad, próximo paso chiquito. Una destacada.
- Aportes libres, a la medida de lo que entra. Si no hay excedente, no se propone ahorrar. Sin
  porcentajes universales.
- **Reserva de seguridad**: hitos elegidos por la persona; opcionalmente expresada en «meses de
  gastos esenciales cubiertos», con los gastos esenciales cargados por ella y el supuesto a la
  vista. Usarla se registra como su finalidad.
- **Asignación virtual** (apartada adentro de la app) vs **transferencia real** (movida a otra
  cuenta): se elige al aportar y se muestra distinto.
- **Deudas** (etapa 2 salvo lo que ya cubren tarjetas y cuotas): saldo, vencimientos, cuotas,
  costos conocidos (CFT, intereses) cargados a mano, escenarios con supuestos explícitos.
- **Inversión** (etapa 3, educativa): objetivo, horizonte, necesidad de liquidez, comprensión del
  riesgo, simulaciones que muestran también pérdidas. Sin trading, sin premios por operar, sin
  recomendaciones automáticas, sin ejecutar operaciones, sin prometer rendimientos.

## 11. Volver después de una pausa (central)

- Se considera pausa **7 días o más** sin abrir la app.
- Pantalla de regreso, sin reproches, con el salchicha si está activo: «Podemos seguir desde hoy».
- Dos caminos, el primero destacado:
  - **«Poner al día cómo estoy hoy»**: para cada cuenta, «¿cuánto tenés ahora?». Si no coincide
    con lo calculado, se registra un **ajuste** «diferencia sin conciliar» por la diferencia, sin
    categoría inventada y sin reconstruir movimientos. Después, los compromisos que vencieron en
    la pausa: «¿Lo pagaste?» (sí / no / no me acuerdo → queda pendiente).
  - **«Revisar también lo que pasó»**: lo mismo, más la opción de anotar movimientos con fecha
    del período de la pausa antes de ajustar.
- Se puede salir en cualquier paso: lo hecho queda hecho.
- El historial no se toca.

## 12. Hormiguita

- Opcional, se apaga aparte. Aparece chiquita en una esquina que no tape nada ni intercepte
  toques (fuera de la barra de navegación y del botón «Anotar»).
- **Cuándo**: como mucho una vez cada 3 días, solo en Hoy, nunca durante un comprobante, un
  formulario, la revisión de regreso ni el modo baja energía. Si se ignora, se va sola a los 20
  segundos. Si se descarta con «Ahora no», no vuelve por 7 días.
- Al tocarla: «¿Quedó algún gasto chiquito sin anotar?» → **Anotar uno** / **Ya revisé** /
  **Ahora no**.
- No trata los gastos chicos como desperdicio.
- Con movimiento reducido, aparece sin caminar.

## 13. Recordatorios

**[decidido] Sin servidor no hay notificaciones del sistema confiables.** Se hace lo que sí
funciona y se dice con honestidad, igual que en Pipí Cucú (`src/lib/aviso.ts`):

- Exportar compromisos a `.ics` para el calendario del teléfono, con recordatorio: es lo que
  funciona con la app cerrada. El texto del evento no lleva importes por defecto («Vence un
  pago», no «Tarjeta $180.000»), para que no se vea en la pantalla bloqueada.
- Avisos dentro de la app mientras está abierta.
- Todo voluntario y configurable; horario de silencio; la frecuencia nunca aumenta porque se
  ignoren.
- Notificaciones push reales: etapa 2, solo si hay backend.

## 14. Tecnología y privacidad

- **[decidido]** Misma base que Pipí Cucú: React 18 + TypeScript estricto + Vite, PWA
  instalable, `useReducer` + Context, persistencia local con validación, pruebas con Vitest y
  de punta a punta con Playwright. Sin backend en la etapa 1.
- Capas separadas: `lib/finanzas/` (motor), `lib/comprobantes/` (OCR y extracción),
  `lib/huellitas/` (recompensas), `lib/texto/` (analizador), y la interfaz aparte.
- **Nada sale del dispositivo** en la etapa 1: sin llamadas de red, sin analítica, sin
  terceros, sin datos financieros en `console.log`. Se verifica con un `grep` en las pruebas.
- **Límite de la persistencia local, dicho en la app**: los datos viven en este navegador; si se
  borran los datos del sitio o se pierde el teléfono, se pierden. Por eso la exportación está a
  un toque y se sugiere cada tanto (sin insistir).
- Exportar (JSON completo + CSV de movimientos), importar esa copia, y borrar todo con
  confirmación.
- Estados de carga, error, vacío y recuperación en cada pantalla que los pueda tener.
- Ningún botón que parezca funcionar y no haga nada. Lo que viene después, si se muestra, está
  marcado «Próximamente» y no compite con lo que funciona.
- Si hay backend (etapa 2 o 3): credenciales solo del lado del servidor, aislamiento entre
  personas, y una política de privacidad que diga exactamente qué se envía.

## 15. Etapas

**Etapa 1** (se entrega en este orden, con un commit funcionando al final de cada paso):

1. Base: proyecto, tokens visuales en los dos temas, navegación, «Anotar» fijo, persistencia,
   deshacer, exportar/borrar.
2. Motor: cuentas, movimientos (los seis tipos), tarjeta de crédito con cuotas, compromisos,
   disponibilidad con su explicación. Con pruebas.
3. Hoy, Mi plata, primer uso, datos de ejemplo separados.
4. Registro por texto natural.
5. Volver después de una pausa + modo baja energía.
6. Una meta y la reserva de seguridad.
7. Salchicha configurable, huellita, primer truco.
8. Hormiguita.
9. Comprobantes con OCR local.

**Etapa 2**: más trucos, voz opcional, varias operaciones por captura, resúmenes de tarjeta,
importar CSV, deudas con escenarios, conciliación más fina, accesos rápidos, backend opcional
para lectura con IA y push.

**Etapa 3**: integraciones bancarias verificadas, compartir con una persona elegida con permisos
revocables, planificación e inversión educativa.

## 16. Verificación

Pruebas unitarias del motor con casos concretos, por ejemplo:

- Cuenta de $100.000, compra con crédito de $30.000 en 3 cuotas, pago del resumen: el gasto total
  del período es $10.000, no $40.000.
- Transferencia de $20.000 entre dos cuentas propias: el disponible no cambia.
- Compromiso de $15.000 cubierto con una asignación de $15.000: se resta una vez.
- Cuenta en pesos y cuenta en dólares: ningún total las suma.
- Factura de luz fotografiada → compromiso pendiente; comprobante de pago de esa factura →
  movimiento, y se ofrece marcar el compromiso como pagado.
- Mismo ticket cargado a mano y por foto → aviso de duplicado, los dos se conservan hasta que la
  persona decida.
- Regreso tras 20 días con saldo real $12.000 menor al calculado → un ajuste por $12.000.
- Huellitas: anotar diez gastos en un día llena una sola almohadilla; los trucos siguen ahí
  después de 60 días sin abrir.
- OCR: imagen ilegible → sin importe propuesto; OCR que falla → formulario manual.
- Apagar perro, hormiga y celebraciones: ninguna función financiera cambia.

De punta a punta (Playwright, a 360 px): anotar, editar, borrar y deshacer; cerrar y reabrir y
que todo siga; dos pestañas sin pisarse; movimiento reducido; navegación solo con teclado.
Capturas de pantalla de cada pantalla en teléfono, claro y oscuro.

## 17. Forma de trabajar y entregar

- Autonomía: decidí lo razonable, anotá el supuesto en una línea y seguí. Preguntá solo si el
  bloqueo es real.
- Empezá con un resumen corto de decisiones y construí. No repitas esta especificación.
- Al cerrar cada paso: qué funciona, cómo probarlo, qué se verificó (con la salida real de las
  pruebas), qué falta y qué depende de algo externo. Diferenciá **implementado**,
  **demostración** y **futuro**.
- No inventes pruebas corridas, resultados clínicos, integraciones ni extracciones.
- Un `CLAUDE.md` propio de la app nueva, con las reglas que no se adivinan leyendo el código.

---

## Notas sobre esta versión

Qué cambió respecto del pedido original y por qué:

1. **Se agregó el contexto del repositorio (§0).** El pedido original no sabía que acá ya hay una
   app publicada que se despliega sola desde `main`. Sin eso, lo más probable era construir la
   app nueva encima de Pipí Cucú.
2. **Se resolvieron tres contradicciones con «nada sale del dispositivo»**, que es una promesa
   que ya hace la política de privacidad del proyecto:
   - Comprobantes: OCR local en vez de un servicio externo, para que la extracción sea real
     desde la etapa 1 sin mandar imágenes a nadie.
   - Voz: el reconocimiento del navegador manda el audio afuera; pasa a etapa 2 y opcional.
   - Notificaciones: sin servidor no hay push confiable; se usa `.ics`, que es lo que ya
     funcionó en Pipí Cucú.
3. **Se definieron los números que el original dejaba abiertos**, porque sin ellos cada
   implementación inventa los suyos: la fórmula del disponible, el período por defecto, qué es
   una pausa (7 días), la frecuencia de la hormiga, cuántas veces cuenta cada acción para la
   huellita, el criterio de duplicado.
4. **Se modelaron la tarjeta de crédito y las cuotas**, que es donde más fácil se descuenta dos
   veces lo mismo, con casos de prueba con importes.
5. **Se ordenó la etapa 1 en nueve pasos**, porque tal como estaba era demasiado para un solo
   tramo sin puntos de control.
6. **Se ancló el salchicha en el dibujo que ya existe** en el repositorio, en vez de «si adjunto
   una imagen».
7. **Se quitó el género fijo** de «Podés cerrar tranquilo» (se elige en Ajustes, con una forma
   neutra por defecto).
8. **Se agregó la verificación con casos concretos** en lugar de una lista de temas.

Lo que sigue **[a confirmar]**: dónde vive la app (repositorio nuevo o carpeta aparte), el
nombre, y si el OCR local alcanza o se quiere la lectura con IA externa desde el principio.
