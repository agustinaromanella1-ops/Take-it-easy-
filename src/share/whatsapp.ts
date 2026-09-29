import { Platform, Share } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Abrir WhatsApp con el texto listo cuando el destinatario es un grupo.
 *
 * WhatsApp no publica ninguna forma de abrir un grupo concreto desde afuera:
 * el deep link `wa.me` y el esquema `whatsapp://send` solo aceptan un número
 * de teléfono. Los links de `chat.whatsapp.com` sirven para *unirse* a un
 * grupo, no para abrirlo con un mensaje escrito.
 *
 * Lo que sí se puede es entregarle el texto a WhatsApp y dejar que la usuaria
 * elija el chat —incluido cualquier grupo— de su propia lista. Es un toque más
 * que con un contacto, y es lo máximo que la plataforma permite.
 */

const PAQUETE_WHATSAPP = 'com.whatsapp';

export async function compartirConWhatsApp(texto: string): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      // Apuntando al paquete de WhatsApp se saltea el menú de "compartir con
      // qué app" y se abre directo su lista de chats: un paso menos.
      await IntentLauncher.startActivityAsync('android.intent.action.SEND', {
        packageName: PAQUETE_WHATSAPP,
        type: 'text/plain',
        extra: { 'android.intent.extra.TEXT': texto },
      });
      return;
    } catch {
      // WhatsApp no instalado, o una capa de fabricante que no deja apuntar
      // al paquete: se cae al menú de compartir del sistema.
    }
  }

  await Share.share({ message: texto });
}
