import { Alert, Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import type { Adjunto } from '../domain/adjunto';
import type { WhatsAppApp } from '../domain/types';
import { whatsappSchemeUrl, whatsappWebUrl } from '../domain/whatsapp';

/**
 * Abrir WhatsApp con el texto listo.
 *
 * Dos cosas que la plataforma decide por nosotros:
 *
 * 1. **No se puede abrir un grupo concreto desde afuera.** El deep link
 *    `wa.me` y el esquema `whatsapp://send` solo aceptan un número, y los
 *    links de `chat.whatsapp.com` sirven para *unirse* a un grupo, no para
 *    abrirlo con un mensaje escrito. Para grupos se le entrega el texto a
 *    WhatsApp y la usuaria elige el chat de su lista.
 *
 * 2. **Elegir entre WhatsApp y WhatsApp Business solo se puede en Android.**
 *    Las dos apps registran el mismo esquema `whatsapp://`, así que un link
 *    a secas abre la que el sistema prefiera —o un menú, si están las dos—.
 *    En Android se puede apuntar al paquete y no hay ambigüedad. En iPhone
 *    no hay forma pública de distinguirlas, y la interfaz lo dice.
 *
 * 3. **Con un archivo adjunto no se puede ni apuntar al paquete ni mandar el
 *    texto.** Entregar un archivo a otra app exige un `content://` con
 *    permiso de lectura, y eso en Expo lo hace `expo-sharing`, que siempre
 *    abre el menú del sistema: no acepta un paquete concreto, y su intent
 *    lleva el archivo pero no el texto. Así que con adjunto el texto se copia
 *    al portapapeles para pegarlo de epígrafe, y la app se elige en el menú.
 *    `expo-intent-launcher`, que sí acepta un paquete, no sirve: pasa los
 *    extras por un Bundle de strings y `EXTRA_STREAM` tiene que ser un Uri.
 */

const PAQUETES: Record<WhatsAppApp, string> = {
  normal: 'com.whatsapp',
  business: 'com.whatsapp.w4b',
};

export const NOMBRES: Record<WhatsAppApp, string> = {
  normal: 'WhatsApp',
  business: 'WhatsApp Business',
};

/** Solo Android puede elegir entre las dos apps. */
export const puedeElegirApp = (): boolean => Platform.OS === 'android';

/** Abre el chat de un contacto con el texto ya cargado. */
export async function abrirChat(
  e164: string,
  texto: string,
  app: WhatsAppApp | null,
): Promise<void> {
  const esquema = whatsappSchemeUrl(e164, texto);
  const web = whatsappWebUrl(e164, texto);

  if (Platform.OS === 'android' && app) {
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: esquema,
        packageName: PAQUETES[app],
      });
      return;
    } catch {
      // Esa app no está instalada, o la capa del fabricante no deja apuntar
      // al paquete: se sigue por el camino común.
    }
  }

  try {
    const abrible = await Linking.canOpenURL(esquema);
    await Linking.openURL(abrible ? esquema : web);
  } catch {
    await Linking.openURL(web);
  }
}

/** Entrega el texto a WhatsApp para que la usuaria elija el grupo. */
export async function compartirConWhatsApp(
  texto: string,
  app: WhatsAppApp | null,
): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      // Apuntando al paquete se saltea el menú de "compartir con qué app" y
      // se abre directo la lista de chats de la que corresponda.
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        packageName: PAQUETES[app ?? 'normal'],
        type: 'text/plain',
        extra: { 'android.intent.extra.TEXT': texto },
      });
      return;
    } catch {
      // Sin esa app instalada, cae al menú del sistema.
    }
  }

  await Share.share({ message: texto });
}

/**
 * Manda un mensaje con archivo. Devuelve si el texto quedó en el portapapeles,
 * para poder avisarlo.
 *
 * En iPhone el texto y el archivo viajan juntos en la hoja de compartir y
 * WhatsApp suele tomar el texto como epígrafe; igual se copia, porque
 * "suele" no es "siempre" y perder el mensaje escrito sería lo peor que
 * puede pasar acá.
 */
export async function compartirArchivo(
  uri: string,
  adjunto: Adjunto,
  texto: string,
  app: WhatsAppApp | null,
): Promise<{ textoCopiado: boolean; compartido: boolean }> {
  let textoCopiado = false;
  if (texto.trim()) {
    try {
      await Clipboard.setStringAsync(texto);
      textoCopiado = true;
    } catch {
      // Sin portapapeles el archivo igual sale; el texto se puede copiar a
      // mano desde el detalle del mensaje.
    }
  }

  if (Platform.OS === 'ios') {
    try {
      await Share.share({ message: texto, url: uri });
      return { textoCopiado, compartido: true };
    } catch {
      // Cae a la hoja de expo-sharing, que manda el archivo solo.
    }
  }

  if (!(await Sharing.isAvailableAsync())) {
    // No debería pasar en un teléfono, pero fallar en silencio sería peor:
    // la usuaria vería el mensaje marcado como mandado y nada abierto.
    return { textoCopiado, compartido: false };
  }

  await Sharing.shareAsync(uri, {
    mimeType: adjunto.mime,
    // El menú del sistema no se puede saltear con un adjunto, así que por
    // lo menos el título recuerda cuál de las dos apps eligió.
    dialogTitle: app ? `Elegí ${NOMBRES[app]}` : 'Elegí WhatsApp',
  });

  return { textoCopiado, compartido: true };
}

/**
 * Pregunta desde qué WhatsApp mandar, para quien tiene las dos y no quiere
 * fijar una por defecto. Devuelve null si cierra sin elegir.
 */
export function preguntarApp(): Promise<WhatsAppApp | null> {
  return new Promise((resolver) => {
    Alert.alert(
      '¿Desde qué WhatsApp?',
      'Podés fijar una por defecto en Ajustes para que no te pregunte más.',
      [
        { text: NOMBRES.normal, onPress: () => resolver('normal') },
        { text: NOMBRES.business, onPress: () => resolver('business') },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolver(null) },
      ],
      { cancelable: true, onDismiss: () => resolver(null) },
    );
  });
}
