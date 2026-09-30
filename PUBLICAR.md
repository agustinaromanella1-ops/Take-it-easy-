# Publicar en Google Play

Esto es para hacer una vez. Después, cada actualización es apretar un botón.

## Qué es la clave de subida

Google Play firma la app con una clave que guarda él y que vos nunca ves. Lo
que generás acá es otra cosa: la **clave de subida**, que sirve para
demostrarle a Play que la entrega la mandás vos. Son dos claves distintas y
sólo una es tuya.

Si perdés la de subida, Play te la deja cambiar pidiéndolo por soporte: es un
trámite, no una catástrofe. Igual hacé la copia del paso 3, porque el trámite
tarda días y las actualizaciones quedan frenadas mientras tanto.

Lo que sí no tiene arreglo es que la clave se filtre. Por eso:

- **No la subas al repositorio.** `.gitignore` ya ignora cualquier `.keystore`,
  pero la regla vale igual.
- **No me la pases por el chat, ni a mí ni a nadie.** Tampoco la contraseña.
  Nada de lo que hablamos acá necesita conocerlas.

## Paso 1 — ¿Tenés Java?

`keytool`, el programa que genera la clave, viene con Java. Abrí una terminal
y probá:

```
java -version
```

Si contesta con un número de versión, seguí al paso 2.

Si dice que no encuentra el comando, instalá **Temurin 21** desde
<https://adoptium.net>, cerrá la terminal, abrila de nuevo y volvé a probar.
Son unos cinco minutos y es lo único lento de todo esto.

> Cómo abrir una terminal: en Windows, buscá «PowerShell» en el menú de
> inicio. En Mac, buscá «Terminal» con Spotlight (⌘ + espacio).

## Paso 2 — Generar la clave

Pegá esto tal cual, **cambiando las dos contraseñas** por una que elijas vos.
Tiene que tener al menos seis caracteres y las dos van iguales:

```
keytool -genkeypair -v -keystore subida.keystore -alias subida -keyalg RSA -keysize 2048 -validity 10000 -storepass TU_CONTRASEÑA -keypass TU_CONTRASEÑA -dname "CN=Take it easy, O=Take it easy, C=AR"
```

Queda un archivo `subida.keystore` en la carpeta donde estabas parada. Para
ver dónde:

- Windows: `Get-Location`
- Mac o Linux: `pwd`

Anotá la contraseña en el mismo lugar donde guardás las demás. La vas a
necesitar cada vez que publiques una actualización, y no hay forma de
recuperarla del archivo.

## Paso 3 — La copia

Guardá `subida.keystore` en **dos lugares distintos** que no sean esta
computadora. Un gestor de contraseñas que acepte archivos adjuntos y un pendrive
guardado en otro lado alcanzan. Un correo a vos misma no: si perdés el acceso
a la casilla, perdés las dos cosas juntas.

## Paso 4 — Cargar los datos en GitHub

Los cuatro datos van a GitHub como *secretos*: GitHub los guarda cifrados, se
los pasa a la máquina que compila y no los muestra nunca más, ni a vos ni en
los registros de la compilación.

Primero convertí el archivo a texto, porque un secreto sólo puede ser texto:

- **Windows** (PowerShell), parada en la carpeta del archivo:
  ```
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("subida.keystore")) | Set-Clipboard
  ```
  Eso deja el texto en el portapapeles, listo para pegar.

- **Mac**:
  ```
  base64 -i subida.keystore | tr -d '\n' | pbcopy
  ```

- **Linux**:
  ```
  base64 -w0 subida.keystore | xclip -selection clipboard
  ```

Después andá a
`Settings → Secrets and variables → Actions → New repository secret` del
repositorio, y cargá estos cuatro, uno por uno, con estos nombres exactos:

| Nombre | Qué va adentro |
| --- | --- |
| `CLAVE_DE_SUBIDA_BASE64` | el texto largo que quedó en el portapapeles |
| `CLAVE_DE_SUBIDA_ALMACEN` | la contraseña que elegiste |
| `CLAVE_DE_SUBIDA_ALIAS` | `subida` |
| `CLAVE_DE_SUBIDA_CLAVE` | la misma contraseña otra vez |

Los dos últimos parecen repetidos y no lo son: un archivo de claves puede
tener varias claves adentro, cada una con su nombre y su contraseña. Acá hay
una sola, llamada `subida`, y le pusimos la misma contraseña que al archivo.

## Paso 5 — Compilar el archivo que se sube

En la pestaña **Actions** del repositorio, elegí **AAB para Play** y apretá
**Run workflow**. Si falta alguno de los cuatro secretos, se corta en el
primer paso y te dice cuál.

Cuando termina, abajo de todo en la página de esa corrida queda
`take-it-easy-aab` para descargar. Adentro está `app-release.aab`, que es lo
que Play pide.

El workflow no corre solo, a propósito: cada corrida gasta un número de
entrega y Play no deja repetirlo ni bajarlo nunca.

## Paso 6 — Lo que Play pide aparte del archivo

Esto todavía no está hecho:

- [ ] **Política de privacidad publicada**, con una dirección web propia. Es
      obligatoria y además va enlazada desde Ajustes.
- [ ] **Formulario de seguridad de los datos**. Para esta app las respuestas
      son casi todas «no»: no recoge datos, no los comparte, no salen del
      teléfono.
- [ ] **Capturas de pantalla** del teléfono, y un gráfico de 1024 × 500.
- [ ] **Descripción corta y larga**.
- [ ] **Clasificación de contenido**, que es un cuestionario.
