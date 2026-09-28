import React, { useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractVariables } from '../domain/templates';
import { useMessages } from '../state/MessagesContext';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { EmptyState, Txt } from '../components/ui';
import { PromptModal } from '../components/PromptModal';

export function TemplatesScreen(): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { templates, editTemplate, deleteTemplate } = useMessages();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null,
  );

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('¿Borrar la plantilla?', `Se va a borrar "${name}".`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => void deleteTemplate(id),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing(2),
          paddingBottom: insets.bottom + spacing(4),
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
            Las plantillas se crean desde la pantalla de un mensaje nuevo: poné
            algo entre llaves, como {'{nombre}'}, y guardala.
          </Txt>
        }
        renderItem={({ item }) => {
          const variables = extractVariables(item.body);
          return (
            <View
              style={{
                backgroundColor: p.surface,
                borderColor: p.border,
                borderWidth: BORDER_WIDTH,
                borderRadius: radius.md,
                padding: spacing(2),
                marginBottom: spacing(1.25),
              }}
            >
              <Txt style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
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
                  Completa: {variables.map((v) => `{${v}}`).join(', ')}
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
                  onPress={() => setRenaming({ id: item.id, name: item.name })}
                >
                  <Txt
                    style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}
                  >
                    Renombrar
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => confirmDelete(item.id, item.name)}
                >
                  <Txt
                    style={{ color: p.danger, fontSize: 15, fontWeight: '700' }}
                  >
                    Borrar
                  </Txt>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no hay plantillas"
            detail="Sirven para los mensajes que mandás seguido cambiando solo un par de datos."
          />
        }
      />

      <PromptModal
        visible={renaming !== null}
        title="Renombrar plantilla"
        initialValue={renaming?.name ?? ''}
        onConfirm={(name) => {
          if (renaming) void editTemplate(renaming.id, { name });
          setRenaming(null);
        }}
        onCancel={() => setRenaming(null)}
      />
    </View>
  );
}
