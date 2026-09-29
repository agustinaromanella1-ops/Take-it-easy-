import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { extractVariables } from '../domain/templates';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Button, Label, Title, Txt } from './ui';

/**
 * Crear o editar una plantilla completa: nombre y texto juntos.
 *
 * Antes solo se podían renombrar, y crearlas exigía saber de antemano que
 * había que escribir algo entre llaves en un mensaje nuevo para que apareciera
 * el botón. Una función que no se puede encontrar es una función que no está.
 */
export function TemplateEditor({
  visible,
  titulo,
  nombreInicial = '',
  textoInicial = '',
  onGuardar,
  onCancelar,
}: {
  visible: boolean;
  titulo: string;
  nombreInicial?: string;
  textoInicial?: string;
  onGuardar: (nombre: string, texto: string) => void;
  onCancelar: () => void;
}): React.ReactElement {
  const p = usePalette();
  const [nombre, setNombre] = useState(nombreInicial);
  const [texto, setTexto] = useState(textoInicial);

  useEffect(() => {
    if (!visible) return;
    setNombre(nombreInicial);
    setTexto(textoInicial);
  }, [nombreInicial, textoInicial, visible]);

  const variables = extractVariables(texto);
  const puedeGuardar = nombre.trim().length > 0 && texto.trim().length > 0;

  const campo = {
    borderWidth: BORDER_WIDTH,
    borderColor: p.border,
    backgroundColor: p.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.5),
    fontSize: 16,
    color: p.text,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancelar}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        onPress={onCancelar}
        style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: p.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: '90%',
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: spacing(3), gap: spacing(2) }}
            keyboardShouldPersistTaps="handled"
          >
            <Title style={{ fontSize: 22, lineHeight: 28 }}>{titulo}</Title>

            <View>
              <Label>Nombre</Label>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej: Saludo de cumpleaños"
                placeholderTextColor={p.textMuted}
                accessibilityLabel="Nombre de la plantilla"
                style={campo}
              />
            </View>

            <View>
              <Label>Texto</Label>
              <TextInput
                value={texto}
                onChangeText={setTexto}
                multiline
                textAlignVertical="top"
                placeholder="Feliz cumple {nombre}! Que tengas un lindo día"
                placeholderTextColor={p.textMuted}
                accessibilityLabel="Texto de la plantilla"
                style={{ ...campo, minHeight: 120, lineHeight: 22 }}
              />
              <Txt
                style={{
                  color: p.textMuted,
                  fontSize: 13,
                  lineHeight: 19,
                  marginTop: spacing(1),
                }}
              >
                Lo que pongas entre llaves lo vas a completar distinto cada vez.
                Por ejemplo {'{nombre}'} o {'{día}'}.
              </Txt>
              {variables.length > 0 ? (
                <Txt
                  style={{
                    color: p.accent,
                    fontSize: 13,
                    fontWeight: '700',
                    marginTop: spacing(0.5),
                  }}
                >
                  Vas a completar: {variables.map((v) => `{${v}}`).join(', ')}
                </Txt>
              ) : null}
            </View>

            <Button
              label="Guardar plantilla"
              disabled={!puedeGuardar}
              onPress={() => onGuardar(nombre.trim(), texto)}
            />
            <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
