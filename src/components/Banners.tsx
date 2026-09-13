import React from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { displayName } from '../domain/phone';
import type { ScheduledMessage } from '../domain/types';
import { radius, spacing, usePalette } from '../theme';
import { Button } from './ui';

/**
 * Sin permiso de notificaciones la app no puede cumplir su única función, así
 * que el aviso es persistente y no se puede descartar.
 */
export function PermissionBanner({
  onRequest,
  denied,
}: {
  onRequest: () => void;
  denied: boolean;
}): React.ReactElement {
  const p = usePalette();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: p.warningSoft,
        borderColor: p.warning,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing(2),
        marginBottom: spacing(2),
      }}
    >
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
        Las notificaciones están apagadas
      </Text>
      <Text
        style={{
          color: p.text,
          fontSize: 14,
          lineHeight: 20,
          marginTop: spacing(0.5),
        }}
      >
        Sin ellas no podemos avisarte cuando llega el momento de mandar un
        mensaje, que es justamente para lo que sirve la app.
      </Text>
      <Button
        label={denied ? 'Abrir ajustes del sistema' : 'Activar notificaciones'}
        variant="secondary"
        onPress={denied ? () => void Linking.openSettings() : onRequest}
        style={{ marginTop: spacing(1.5), alignSelf: 'flex-start' }}
      />
    </View>
  );
}

export function UndoToast({
  onUndo,
  onDismiss,
}: {
  onUndo: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  const p = usePalette();
  return (
    <View
      style={{
        position: 'absolute',
        left: spacing(2),
        right: spacing(2),
        bottom: spacing(3),
        backgroundColor: p.text,
        borderRadius: radius.md,
        paddingVertical: spacing(1.5),
        paddingHorizontal: spacing(2),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing(2),
      }}
    >
      <Text style={{ color: p.bg, fontSize: 15, flex: 1 }}>
        Mensaje cancelado
      </Text>
      <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={12}>
        <Text style={{ color: p.bg, fontSize: 15, fontWeight: '800' }}>
          Deshacer
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={12}>
        <Text style={{ color: p.bg, fontSize: 18, opacity: 0.7 }}>✕</Text>
      </Pressable>
    </View>
  );
}

/**
 * Al volver de WhatsApp preguntamos una vez si el mensaje salió. Si cierra el
 * cartel sin responder, no insistimos: el mensaje queda en la lista igual.
 */
export function ConfirmSentSheet({
  message,
  onSent,
  onSkipped,
  onDismiss,
}: {
  message: ScheduledMessage;
  onSent: () => void;
  onSkipped: () => void;
  onDismiss: () => void;
}): React.ReactElement {
  const p = usePalette();
  const who = displayName(message.contactName, message.phoneE164);

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: '#00000066',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: p.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing(3),
            gap: spacing(1.5),
          }}
        >
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>
            ¿Se lo mandaste a {who}?
          </Text>
          <Text style={{ color: p.textMuted, fontSize: 15, lineHeight: 21 }}>
            Nos sirve para saber si lo guardamos en el historial o lo dejamos
            pendiente.
          </Text>
          <Button label="Sí, lo mandé" onPress={onSent} />
          <Button
            label="No, todavía no"
            variant="secondary"
            onPress={onDismiss}
          />
          <Button label="No lo voy a mandar" variant="ghost" onPress={onSkipped} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
