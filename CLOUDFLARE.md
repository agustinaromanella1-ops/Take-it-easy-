# Publicar en Cloudflare Pages

Gratis, sin créditos que se agoten y sin cartel de la plataforma encima de la app.
El repositorio ya está preparado: no hay que tocar código.

## Por qué los archivos de configuración ya sirven

`public/_redirects` y `public/_headers` salen en `dist/` al compilar, y Cloudflare Pages
los lee con el mismo formato que Netlify. Son los que hacen que recargar dentro de la app
no dé 404 y que el service worker no se congele en una versión vieja.

`netlify.toml` queda en el repositorio sin molestar: Cloudflare lo ignora, y si algún día
se vuelve a Netlify, sigue estando.

`.node-version` fija Node 22, que es con lo que se compila acá.

## Dos caminos, según lo que ofrezca el panel

Cloudflare unificó Pages y Workers, así que el panel puede llevar a cualquiera de los dos.
Los dos sirven; lo único que cambia es qué hay que completar.

### Si dice "Worker" y `npx wrangler deploy`

Ese es el camino nuevo. `wrangler.jsonc` en la raíz ya tiene todo:
la carpeta compilada (`dist`) y el `not_found_handling` que hace que recargar dentro de la
app no dé 404. Alcanza con dejar el nombre del proyecto en `pipi-cucu` —igual que en el
archivo— y el comando de compilación en `npm run build`.

**No activar "Protect with Cloudflare Access"**: pone un inicio de sesión delante de la app
y nadie podría entrar sin cuenta de Cloudflare.

### Si ofrece "Pages"

## Los pasos de Pages

1. Entrar a [dash.cloudflare.com](https://dash.cloudflare.com) y crear una cuenta gratis.
2. **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.
3. Autorizar GitHub y elegir el repositorio `Take-it-easy-`.
4. Completar:

   | Campo | Valor |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

5. **Save and Deploy**.

Queda en `<nombre>.pages.dev`. Cada commit a `main` se publica solo, igual que antes.

## Después de mudarse

- Avisarle a quien tenga la app instalada que la dirección cambió: los datos viven en el
  navegador y son **por dirección**, así que no viajan solos. Hay que exportar desde la
  dirección vieja e importar en la nueva.
- Si se va a publicar en Google Play, hacer la mudanza **antes**: la dirección queda
  grabada dentro del paquete que se sube.
