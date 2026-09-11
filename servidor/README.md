# El proxy del asistente

Un servidor chico que está en el medio entre la app y la API de Anthropic.

Existe por una sola razón: **no meter la clave de la API dentro del APK**. Un
APK se puede abrir y leer; cualquiera que baje el archivo tendría la clave y
podría gastar la cuenta. La clave vive acá, en un servidor que controlás vos.

## Qué no tiene

- **No tiene base de datos.** Ninguna. Menos todavía de alumnos.
- **No guarda las consultas ni las respuestas.** El texto pasa y no queda.
- **No tiene cuentas, ni email, ni contraseña.** La app se identifica con un
  número anónimo que genera el teléfono la primera vez. Sirve para que nadie
  gaste la cuenta haciendo mil consultas, y para nada más.

Lo único que escribe en el registro es: cuándo, si salió bien, cuánto tardó,
cuántos tokens costó y ese número anónimo. **Nunca el texto.** Y no es sólo
una promesa: el registro no recibe el texto, así que no puede escribirlo
aunque alguien se lo pida más adelante "para depurar".

## Ponerlo a andar

Necesita Node 22 o más nuevo.

```bash
npm ci
npm run build
ANTHROPIC_API_KEY=tu-clave npm start
```

Queda escuchando en el puerto 8787, o en el que diga la variable `PORT`.

Para probar que está vivo, sin gastar nada:

```bash
curl http://localhost:8787/salud
# {"ok":true,"configurado":true}
```

`configurado: false` significa que arrancó pero sin clave. Arranca igual a
propósito: así se puede desplegar primero y poner la clave después.

## Dónde alojarlo

Cualquier lugar que corra Node sirve. Lo que hace falta configurar es siempre
lo mismo:

| Cosa | Valor |
|---|---|
| Comando de build | `npm ci && npm run build` |
| Comando de arranque | `npm start` |
| Variable de entorno | `ANTHROPIC_API_KEY` |
| Carpeta raíz | `servidor` |

El puerto no hace falta configurarlo: casi todos los servicios pasan `PORT` y
el servidor lo usa.

## Conectar la app

La app lee la dirección del proxy de la variable `VITE_ASISTENTE_URL` **en el
momento de compilar**, así que se configura donde se compila el APK: en
GitHub, en Settings → Secrets and variables → Actions → Variables, con el
nombre `ASISTENTE_URL` y la dirección del proxy como valor.

Sin esa variable la app funciona completa —asistencia, materias, copias de
seguridad— y el asistente avisa que no está conectado. Es la única función
que necesita internet.

## Qué contesta

Una línea de JSON por evento, a medida que el modelo escribe:

```
{"tipo":"texto","texto":"Yo arrancaría por lo concreto: "}
{"tipo":"texto","texto":"Estudiante A faltó a las últimas tres clases."}
{"tipo":"fin"}
```

Si algo sale mal, la última línea es `{"tipo":"error","motivo":...}`. Se eligió
así, y no texto pelado, porque un rechazo o una falla tienen que poder llegar
en el medio de la respuesta, y no hay forma de distinguirlos si lo único que
viaja son caracteres sueltos.

## Lo que cuesta

Cada consulta paga los tokens que usa. El modelo es `claude-opus-5` con
esfuerzo bajo, que para redactar una observación o un mensaje es lo que
corresponde. El tope por instalación está en 60 consultas por hora, y se
cambia en `src/limite.ts`.
