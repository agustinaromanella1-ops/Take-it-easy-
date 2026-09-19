# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Todo el proyecto está en español rioplatense: código, comentarios, commits y textos de la app.
Seguí en ese idioma.

## Comandos

```bash
npm run dev                          # desarrollo
npm run build                        # tsc --noEmit && vite build
npm test                             # las 221 pruebas unitarias
npx vitest run src/lib/money.test.ts # una sola
npm run typecheck
```

Las pruebas de punta a punta necesitan la app compilada y servida:

```bash
npx vite build && npx vite preview --port 4173 &
node e2e/aceptacion.mjs     # 102 verificaciones sobre la app entera
node e2e/bienvenida.mjs     # 43: la portada contra el diseño aprobado
```

**Playwright no es una dependencia del proyecto**: se resuelve desde la instalación global. Si
`import { chromium } from 'playwright'` falla, enlazalo con
`ln -s /opt/node22/lib/node_modules/playwright node_modules/playwright` (y `playwright-core`).

`e2e/extraer-nubes.mjs` no es una prueba: vuelve a extraer la capa de nubes de la portada desde
`src/assets/pipi-cucu-welcome-reference.png`. Solo hace falta si cambia esa imagen.

## Arquitectura

React 18 + TypeScript estricto + Vite. **No hay router**: la navegación es estado en `App.tsx`.

- `src/store/` — `useReducer` + Context. El reducer es la única puerta de entrada a los datos.
  `selectors.ts` deriva todo lo que se muestra; las pantallas no calculan.
- `src/lib/` — lógica pura y probada. Es donde va cualquier regla de negocio nueva.
- `src/pages/` y `src/components/` — presentación.
- Persistencia en `localStorage`, con guardado postergado y una bandera `dirty` en `StoreContext`
  para que una pestaña que no tocó nada no pise lo que escribió otra.

`src/lib/storage.ts` valida campo por campo lo que vuelve de `localStorage` y descarta lo inválido
en vez de confiar en un `as AppData`. `LEGACY_KEYS` va de la clave más nueva a la más vieja, porque
quien usó varias versiones tiene datos en varias claves.

## Reglas que no se adivinan leyendo el código

**La plata es siempre un entero de centavos.** Nunca un float: `0.1 + 0.2` factura mal.
`formatMoney` y `parseMoney` son la única frontera con el texto.

**Las fechas locales son texto `YYYY-MM-DD`.** Usá `fromISODate()` de `src/lib/dates.ts`, nunca
`new Date('2026-03-10')`: eso parsea en UTC y en Argentina devuelve el día anterior.

**El sello y las lápidas los pone el reducer, no quien despacha.** Cada registro lleva `updatedAt`
y borrar deja una `Lapida` con id y fecha —nunca contenido—. Los payloads excluyen `updatedAt` por
tipo, así no hay forma de olvidárselo. Ver `SINCRONIZACION.md`.

**Si cambiás `SCHEMA_VERSION`, la migración tiene que guardarse al leer.** `loadData` persiste
enseguida cuando la versión leída no coincide: si no, a lo que no tiene sello se le inventa uno
nuevo en cada arranque y todo parece recién editado.

**Los colores de los gráficos están validados para daltonismo y viven en el CSS**, no en el
JavaScript, porque el modo oscuro necesita otros tonos. Hay un juego por tema (`--grafico-1/2/3`).
No los cambies a ojo: pasan por el verificador de la skill `dataviz`
(`node scripts/validate_palette.js "#hex,#hex" --mode light|dark`), con ΔE ≥ 8 en visión con
daltonismo. Los valores actuales y sus números están en el README.

**Todo par de texto y fondo está medido contra WCAG AA (4,5:1).** Si agregás un color, medilo. El
caso que ya se resolvió: blanco sobre el naranja del botón da 2,7:1 y no pasa, por eso el botón
principal lleva tinta oscura (`--sobre-claro`, 5,9:1) en los dos temas.

**Dos temas.** Todo color va como token en `:root` y, si cambia, también en
`[data-tema='oscuro']`. Un color fijo en una regla deja letra clara sobre fondo claro en oscuro.

**La app está hecha para no depender de la memoria de quien la usa, y eso son
reglas, no estilo.** Antes de mover algo del inicio o de agregar una pantalla, leer
`src/components/Ahora.tsx` y `src/lib/pendientes.ts`:

- Arriba de Inicio va **una** cosa y lo grande es la distancia de tiempo, no la hora.
- De lo que quedó abierto se muestra **una** tarjeta con su botón. La lista entera
  existe en `pendientes()`; mostrarla completa es volver al problema.
- Toda acción que toca los datos pasa por el `dispatch` de `StoreContext`, que guarda
  el estado anterior y ofrece deshacer. Si se agrega una acción al reducer, va también
  su etiqueta en `etiquetaDe()`; sin etiqueta no se ofrece deshacer y el cambio queda
  sin confirmación visible.
- Los formularios largos guardan borrador con `src/lib/borrador.ts`. Lo escrito no se
  pierde nunca por cerrar una pantalla.
- Nada está en rojo por no estar hecho. El rojo (`tone='danger'`) es para errores; la
  plata que todavía no entró va en `'warn'`.

**Para el movimiento usá `sinMovimiento()` de `src/lib/movimiento.ts`**, no `matchMedia` directo:
la preferencia del sistema se puede pisar desde Ajustes y tiene que haber una sola respuesta.

## Trampas que ya costaron caro

**No hagas reemplazos amplios sobre `src/styles.css`.** Un `area → área` para arreglar tildes de
comentarios rompió `safe-area-inset` (invalida el `padding` entero) y `textarea` (dejó sin estilo
todos los campos de texto largo). Editá con contexto suficiente para no tocar identificadores.

**`'\;'` en un literal de JavaScript es `';'`.** El formato ICS necesita el punto y coma escapado:
va `'\;'` en el código y `String.raw` en las pruebas.

**El atributo `hidden` lo pisa cualquier `display: flex`.** Hay un `[hidden] { display: none
!important; }` global que lo restituye; no lo saques.

**Un efecto que depende de una función escrita en el JSX se rearma en cada render.** El `Modal`
de `ui.tsx` tenía `onClose` como dependencia del efecto que pone el foco: cada tecla cambiaba el
estado del formulario, el padre volvía a dibujar, el efecto se rearmaba y el cursor saltaba al
primer campo. Escribir un honorario de cinco cifras era imposible. Si el efecto tiene que leer una
función que cambia, guardala en una ref y dejá las dependencias vacías.

**Verificá que una edición se aplicó.** Un `str_replace` que no encuentra su objetivo puede fallar
en silencio: después de tocar JSX, confirmá con `grep`.

## Publicación

Cloudflare Workers desde `main`, con `wrangler.jsonc`. Cada commit se publica solo.

**No agregues un `public/_redirects` con `/* → /index.html`**: `not_found_handling` en
`wrangler.jsonc` ya hace eso, y Cloudflare rechaza el despliegue entero por bucle infinito.
`public/_headers` sí va, y lo leen Cloudflare y Netlify igual. Ver `CLOUDFLARE.md`.

## Textos de la app

Voseo argentino. **Mayúscula solo en la primera letra**: "Viernes 11 de septiembre", no "Viernes 11
De Septiembre". Los comentarios explican **por qué** se hizo algo, no qué hace la línea.

La portada (`src/components/Welcome.tsx`) reproduce un diseño aprobado y sus medidas salen de medir
`src/assets/pipi-cucu-welcome-reference.png` pixel a pixel. `e2e/bienvenida.mjs` lo vuelve a
comprobar: si tocás esa pantalla, corrélo.

## Datos sensibles

La app maneja datos de salud. Nada sale del dispositivo: no hay llamadas de red, ni analítica, ni
terceros —la política de privacidad lo afirma y `public/privacidad.html` se apoya en eso—. Antes de
tocar esa página, volvé a comprobarlo:

```bash
grep -rE "fetch\(|XMLHttpRequest|analytics|gtag" src/ --include=*.ts --include=*.tsx
```

`.gitignore` bloquea `*.keystore`, `*.jks` y `keystore.properties`. La clave de firma de Android y
su contraseña no van al repositorio ni a un comentario.
