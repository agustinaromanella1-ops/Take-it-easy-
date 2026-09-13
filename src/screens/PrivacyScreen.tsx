import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, usePalette } from '../theme';
import { Card } from '../components/ui';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Nada sale de tu teléfono',
    body: 'El texto de tus mensajes, los destinatarios, las fechas y tus plantillas se guardan solo en este dispositivo. No hay servidor, no hay cuenta, no hay registro. Si desinstalás la app, se borra todo con ella.',
  },
  {
    title: 'Tus contactos',
    body: 'Si le das permiso, la app abre el selector de contactos del sistema y guarda solo a la persona que elegiste. No lee tu agenda completa ni la copia a ningún lado. Podés negar el permiso y escribir los números a mano: funciona igual.',
  },
  {
    title: 'Notificaciones',
    body: 'Son locales: las programa el sistema de tu propio teléfono. No hay push, no hay servidor que las mande, y ningún identificador sale del dispositivo.',
  },
  {
    title: 'Sin terceros',
    body: 'La app no incluye analytics, publicidad, seguimiento ni reporte de errores. No hay nadie más con acceso a tus datos porque no hay datos viajando.',
  },
  {
    title: 'Relación con WhatsApp',
    body: 'Esta app no es oficial ni está asociada a WhatsApp ni a Meta. No se conecta a sus servidores ni accede a tus conversaciones. Solo abre WhatsApp con un enlace público, con el texto ya cargado, para que vos toques enviar.',
  },
  {
    title: 'Backups',
    body: 'El archivo de backup lo guardás vos donde quieras con el menú de compartir. No se sube a ningún lado. Si elegís guardarlo en la nube, pasa a regirse por las condiciones de ese servicio.',
  },
];

export function PrivacyScreen(): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        padding: spacing(2),
        paddingBottom: insets.bottom + spacing(4),
        gap: spacing(2),
      }}
    >
      <Text style={{ color: p.text, fontSize: 17, lineHeight: 24 }}>
        Esta app no recolecta, transmite ni almacena tus datos en ningún
        servidor. Todo lo que escribís queda en tu teléfono.
      </Text>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {section.title}
          </Text>
          <Text
            style={{
              color: p.textMuted,
              fontSize: 15,
              lineHeight: 21,
              marginTop: spacing(0.75),
            }}
          >
            {section.body}
          </Text>
        </Card>
      ))}

      <View>
        <Text style={{ color: p.textMuted, fontSize: 13, lineHeight: 19 }}>
          Última actualización: 13 de septiembre de 2026.
        </Text>
      </View>
    </ScrollView>
  );
}
