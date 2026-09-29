import React, { useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractVariables, type Template } from '../domain/templates';
import { useMessages } from '../state/MessagesContext';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Button, EmptyState, HardShadow, Txt } from '../components/ui';
import { TemplateEditor } from '../components/TemplateEditor';

/** Qué está abierto en el editor: nada, una plantilla nueva, o una existente. */
type Edicion = null | { modo: 'nueva' } | { modo: 'editar'; plantilla: Template };

export function TemplatesScreen(): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { templates, saveTemplate, editTemplate, deleteTemplate } = useMessages();
  const [edicion, setEdicion] = useState<Edicion>(null);

  const confirmarBorrado = (id: string, nombre: string) => {
    Alert.alert('¿Borrar la plantilla?', `Se va a borrar "${nombre}".`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => void deleteTemplate(id),
      },
    ]);
  };

  const guardar = (nombre: string, texto: string) => {
    if (edicion?.modo === 'editar') {
      void editTemplate(edicion.plantilla.id, { name: nombre, body: texto });
    } else {
      void saveTemplate(nombre, texto);
    }
    setEdicion(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing(2),
          paddingBottom: insets.bottom + spacing(12),
        }}
        ListHeaderComponent={
          <Txt
            style={{
              color: p.textMuted,
              fontSize: 15,
              lineHeight: 21,
              marginBottom: spacing(2),
            }}
          >
            Para los mensajes que mandás seguido cambiando solo un par de datos.
            Lo que pongas entre llaves, como {'{nombre}'}, lo completás en el
            momento.
          </Txt>
        }
        renderItem={({ item }) => {
          const variables = extractVariables(item.body);
          return (
            <HardShadow
              size="sm"
              corner={radius.md}
              style={{ marginBottom: spacing(1.5) + 3 }}
            >
              <View
                style={{
                  backgroundColor: p.surface,
                  borderColor: p.border,
                  borderWidth: BORDER_WIDTH,
                  borderRadius: radius.md,
                  padding: spacing(2),
                }}
              >
                <Txt style={{ color: p.ink, fontSize: 16, fontWeight: '700' }}>
                  {item.name}
                </Txt>
                <Txt
                  numberOfLines={3}
                  style={{
                    color: p.textMuted,
                    fontSize: 15,
                    lineHeight: 20,
                    marginTop: spacing(0.5),
                  }}
                >
                  {item.body}
                </Txt>
                {variables.length > 0 ? (
                  <Txt
                    style={{
                      color: p.textMuted,
                      fontSize: 13,
                      marginTop: spacing(1),
                    }}
                  >
                    Completás: {variables.map((v) => `{${v}}`).join(', ')}
                  </Txt>
                ) : null}
                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing(2.5),
                    marginTop: spacing(1.5),
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEdicion({ modo: 'editar', plantilla: item })}
                  >
                    <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
                      Editar
                    </Txt>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => confirmarBorrado(item.id, item.name)}
                  >
                    <Txt style={{ color: p.danger, fontSize: 15, fontWeight: '700' }}>
                      Borrar
                    </Txt>
                  </Pressable>
                </View>
              </View>
            </HardShadow>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no hay plantillas"
            detail="Sirven para los mensajes que mandás seguido cambiando solo un par de datos. Creá la primera con el botón de abajo."
          />
        }
      />

      <View
        style={{
          position: 'absolute',
          left: spacing(2),
          right: spacing(2),
          bottom: insets.bottom + spacing(2),
        }}
      >
        <Button
          label="＋  Nueva plantilla"
          onPress={() => setEdicion({ modo: 'nueva' })}
        />
      </View>

      <TemplateEditor
        visible={edicion !== null}
        titulo={edicion?.modo === 'editar' ? 'Editar plantilla' : 'Nueva plantilla'}
        nombreInicial={edicion?.modo === 'editar' ? edicion.plantilla.name : ''}
        textoInicial={edicion?.modo === 'editar' ? edicion.plantilla.body : ''}
        onGuardar={guardar}
        onCancelar={() => setEdicion(null)}
      />
    </View>
  );
}
