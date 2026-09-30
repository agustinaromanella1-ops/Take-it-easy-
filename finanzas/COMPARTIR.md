# Compartir con una persona de confianza

Una persona elegida puede mirar, sin tocar, lo que la dueña de los datos decide: cuánto puede usar,
lo que vence, las metas o los movimientos de los últimos 30 días. Se corta cuando se quiere.

## Cómo funciona

1. En el teléfono de quien comparte, la app arma una vista con **solo** lo elegido (sin notas, sin
   ids) y la cifra con AES-GCM de 256 bits, con una clave nueva por enlace.
2. Manda al servicio el bloque cifrado. El servicio devuelve un `id` y un `token`.
3. El enlace es `https://<dominio>/ver#<id>.<clave>`. Lo que va después del `#` el navegador no lo
   manda en ningún pedido: **el servidor nunca ve la clave** y no puede leer lo que guarda.
4. Quien abre el enlace pide el bloque por `id` y lo descifra en su navegador.
5. "Mostrarle lo de hoy" vuelve a cifrar y reemplaza el bloque (hace falta el `token`).
   "Dejar de compartir" lo borra: el enlace deja de andar. Todo vence solo a los 30 días.

El `token` y la clave viven en el teléfono de quien comparte (`localStorage`, clave
`salchi:compartidos`), no en los datos ni en la copia de seguridad.

Lo que el servidor sí puede ver: que existe un bloque, su tamaño, cuándo se pide y desde qué IP
(eso lo ve cualquier servidor web). Lo que no puede ver: nada del contenido.

Límite honesto: lo que la otra persona ya vio no se puede des-ver, y cualquiera que tenga el enlace
ve lo compartido. Por eso es de solo lectura, se elige qué va, y vence.

## Contrato del servicio (`server/compartir.js`)

| Pedido | Qué hace |
|---|---|
| `GET /api/compartidos/salud` | `{ servicio: 'salchi-compartir' }`, o 503 si no hay almacenamiento |
| `POST /api/compartidos` `{ cifrado }` | guarda, devuelve `{ id, token }` (201) |
| `GET /api/compartidos/:id` | `{ cifrado }`, o 404 |
| `PUT /api/compartidos/:id` + `Authorization: Bearer <token>` | reemplaza (204), 403 sin token válido |
| `DELETE /api/compartidos/:id` + token | borra (204) |

El servidor guarda el hash SHA-256 del token, no el token. Cuerpos de hasta 200 000 caracteres,
solo base64url.

## Ponerlo en marcha en Cloudflare

La app y el servicio van en el mismo Worker (`server/worker.js`), en el mismo origen: así la
política de contenido de la app (`connect-src 'self'`) no tiene que abrirse a nadie.

```bash
npm run build
npx wrangler kv namespace create COMPARTIDOS   # anota el id
# descomentar "kv_namespaces" en wrangler.jsonc con ese id
npx wrangler deploy
```

Sin el espacio `COMPARTIDOS`, el servicio responde 503 y la app muestra "El servicio para compartir
no está configurado". El resto de la app funciona igual.

Pendiente antes de abrirlo a mucha gente: limitar la cantidad de pedidos por IP (las reglas de
Cloudflare lo hacen sin tocar el código) para que nadie llene el almacenamiento.

## Probarlo sin Cloudflare

```bash
npm run build
node scripts/servidor-local.mjs --puerto 4175              # con almacenamiento en memoria
node scripts/servidor-local.mjs --puerto 4176 --sin-almacen # como si no estuviera configurado
node e2e/etapa3.mjs
```
