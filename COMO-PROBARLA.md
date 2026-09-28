# Cómo bajar la app y probarla

## El camino corto: no necesitás nada instalado

Cada vez que se sube un cambio, **GitHub compila la app solo** y deja el archivo
publicado. Vos entrás desde el celular y lo instalás. No hace falta terminal, ni Node, ni
Android Studio, ni cuenta de Expo.

**El enlace es siempre el mismo**, así que conviene guardarlo en favoritos del teléfono:

> https://github.com/agustinaromanella1-ops/Take-it-easy-/releases/tag/apk-listo-para-enviar

Ahí abajo de todo, en **Assets**, está `listo-para-enviar.apk`. Lo tocás y se baja.

Android te va a advertir que es de origen desconocido — es normal, no viene de Play Store.
Le das **permitir de esta fuente** y después **Instalar**.

Cada vez que cambiemos algo, volvés a ese mismo enlace y bajás la versión nueva. Es el
mismo flujo que ya usás para la agenda docente.

## Los permisos (no te los saltees)

Al abrirla vas a ver tres pantallas de explicación. Al final te pide **notificaciones**:
dale que sí, sin eso la app no hace nada.

En la última pantalla te ofrece dos ajustes más. **Hacé los dos**, son los que deciden si
los avisos llegan puntuales:

- **Permitir alarmas exactas**
- **Quitar la optimización de batería** (buscá la app y ponela en "Sin restricciones")

Si los salteás, después están en Ajustes → Puntualidad de los avisos.

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

## El camino largo (solo si vas a tocar el código)

Para ver los cambios al instante mientras se programa, hace falta una *development build*
y sí necesitás terminal. Esto es para desarrollar, no para probar:

```bash
git clone https://github.com/agustinaromanella1-ops/Take-it-easy-.git
cd Take-it-easy-
git checkout claude/whatsapp-scheduled-messages-prompt-65nixm
npm install
npx expo-doctor                                      # tiene que dar 18/18

npm install -g eas-cli
eas login                                            # cuenta gratis de Expo
eas build --profile development --platform android   # una sola vez
npx expo start --dev-client                          # cada vez que trabajes
```

El celular y la computadora tienen que estar en la misma red de wifi.

## Cómo se compila el APK

El archivo `.github/workflows/apk-de-prueba.yml` hace todo: revisa que el proyecto esté
sano (`tsc` y los tests), genera el proyecto Android con `expo prebuild`, compila con
Gradle y sube el resultado a la publicación de etiqueta fija.

Se compila con `assembleRelease` y no `assembleDebug`: el APK de depuración espera que haya
un servidor de desarrollo escuchando, así que en el teléfono queda en pantalla roja. El de
release trae el JavaScript adentro. Se firma con la clave de depuración, que para probar
alcanza — para publicar en Play hace falta una clave propia.
