# Cómo bajar la app y probarla

## Qué build te conviene

Hay dos formas de tener la app en el teléfono, y sirven para cosas distintas:

| | **preview** | **development** |
|---|---|---|
| Para qué | Usarla como una app normal | Iterar el código |
| Necesita la compu prendida | No | Sí, corriendo el servidor |
| Ves los cambios de código al toque | No, hay que recompilar | Sí, al guardar |

**Si lo que querés es usarla una semana y ver si te sirve, andá por `preview`.** Se instala
y funciona sola, sin computadora de por medio. La de `development` la vamos a necesitar
cuando estemos cambiando cosas.

---

## Paso 0 — Chequear el proyecto (en tu máquina)

```bash
git clone https://github.com/agustinaromanella1-ops/Take-it-easy-.git
cd Take-it-easy-
git checkout claude/whatsapp-scheduled-messages-prompt-65nixm
npm install
npx expo-doctor
```

`expo-doctor` tiene que dar 18/18. Si algo falla, mandame la salida antes de seguir: es más
barato arreglarlo acá que después de una build de 15 minutos.

## Paso 1 — Cuenta de Expo

Gratis, no pide tarjeta.

```bash
npm install -g eas-cli
eas login
```

Si no tenés cuenta, creala en [expo.dev](https://expo.dev) y volvé a este paso.

## Paso 2 — Compilar

```bash
eas build --profile preview --platform android
```

La primera vez te va a preguntar si genera un *keystore* (la firma de la app): decile que sí
y que lo maneje él. Queda guardado en tu cuenta.

Tarda entre 10 y 20 minutos. Se compila en los servidores de Expo, tu máquina solo espera.
Podés cerrar la terminal: el progreso queda en [expo.dev](https://expo.dev) → tu proyecto →
Builds.

## Paso 3 — Instalar en el celular

Cuando termina, la terminal te muestra un **QR y un link**. Abrilo desde el celular y bajá
el APK.

Android te va a advertir que es una app de origen desconocido. Es esperable: no viene de
Play Store. Tenés que darle **Configuración → permitir de esta fuente** (el texto exacto
cambia según el teléfono) y después Instalar.

## Paso 4 — Los permisos

Al abrirla por primera vez vas a ver la explicación de tres pantallas y al final te va a
pedir **notificaciones**. Dale que sí: sin eso la app no hace nada.

En la última pantalla, si estás en Android, te ofrece dos ajustes más. **Hacelos los dos
ahora**, son los que deciden si los avisos llegan puntuales:

- **Permitir alarmas exactas**
- **Quitar la optimización de batería** (buscá la app en la lista y ponela en "Sin optimizar"
  o "Sin restricciones")

Si te los salteás, están después en Ajustes → Puntualidad de los avisos.

---

## Qué probar el primer día

Un guion corto para ver si lo esencial funciona. Lo importante es probar con el **teléfono
bloqueado y la app cerrada**, que es como va a pasar en la vida real.

1. **El camino feliz.** Programá un mensaje para vos mismo dentro de 2 minutos. Bloqueá el
   teléfono y esperá. Tiene que sonar el aviso, y al tocarlo se abre WhatsApp con el texto
   ya escrito.
2. **Que no lleguen dos.** Programá uno para dentro de 5 minutos, y antes de que suene
   reprogramalo con "+1 hora". Tiene que llegar **un solo** aviso, el nuevo.
3. **El atrasado.** Programá uno para dentro de 3 minutos y apagá el teléfono. Prendelo 10
   minutos después: el mensaje tiene que aparecer marcado como atrasado arriba de todo.
4. **Posponer.** Cuando suene un aviso, usá "Posponer 1 hora" desde la notificación.
5. **Un número de la agenda.** Elegí un contacto real y fijate que el número que arma sea el
   correcto (ojo con el 9 de los celulares argentinos).
6. **Cerrar todo.** Matá la app desde el multitarea y dejá un mensaje programado para dentro
   de 10 minutos. Tiene que sonar igual.

Después de unos días, andá a **Ajustes → Puntualidad de los avisos**. La app mide sola
cuánto tardan en llegar y te dice si están llegando tarde.

## Si algo no anda

**No suena ningún aviso.** Casi siempre es la optimización de batería. Ajustes →
Puntualidad de los avisos → los dos botones. En Xiaomi, Samsung, Huawei y Oppo además hay
que buscar en los ajustes del sistema algo tipo "Autoarranque" o "Apps protegidas" y
habilitar la app ahí.

**Los avisos llegan tarde.** Lo mismo de arriba. Si ya hiciste todo y sigue pasando,
contame en qué teléfono y con cuánto retraso: esa info es la que necesito para ajustar.

**No abre WhatsApp.** Fijate que WhatsApp esté instalado y que el número tenga el formato
correcto en la pantalla de detalle del mensaje.

**La build falla.** Copiame el error completo. El log entero queda en expo.dev → Builds.

---

## iOS

Mismo comando con `--platform ios`, pero instalar en un iPhone físico necesita cuenta de
Apple Developer (99 USD al año). Si tenés una Mac, `npx expo run:ios` en el simulador sale
gratis — aunque las notificaciones en simulador no se comportan igual que en un teléfono de
verdad.

Conviene empezar por Android.

---

## Cuando queramos cambiar código

Ahí sí el otro perfil:

```bash
eas build --profile development --platform android   # una sola vez
npx expo start --dev-client                          # cada vez que trabajes
```

Se instala una vez y después levanta el código desde tu máquina. El celular y la compu
tienen que estar en la misma red de wifi.
