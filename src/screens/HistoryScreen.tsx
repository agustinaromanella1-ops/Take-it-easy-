import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useMessages } from '../state/MessagesContext';
import { spacing, usePalette } from '../theme';
import { MessageCard } from '../components/MessageCard';
import { EmptyState } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HistoryScreen(): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { history, duplicateMessage } = useMessages();

  const sorted = [...history].sort((a, b) => {
    const at = a.sentAt ?? a.createdAt;
    const bt = b.sentAt ?? b.createdAt;
    return bt.localeCompare(at);
  });

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: spacing(2),
          paddingBottom: insets.bottom + spacing(4),
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing(2) }}>
            <Text style={{ color: p.text, fontSize: 30, fontWeight: '800' }}>
              Historial
            </Text>
            <Text
              style={{ color: p.textMuted, fontSize: 15, marginTop: spacing(0.5) }}
            >
              Tocá uno para volver a mandarlo.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MessageCard
            message={{ ...item, localAt: null }}
            trailing={
              item.status === 'skipped'
                ? 'No enviado'
                : item.sentAt
                  ? format(parseISO(item.sentAt), "d MMM HH:mm", { locale: es })
                  : ''
            }
            onPress={() => {
              void (async () => {
                const copy = await duplicateMessage(item.id);
                if (copy) navigation.navigate('Compose', { id: copy.id });
              })();
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no mandaste nada"
            detail="Cuando confirmes el envío de un mensaje, va a quedar guardado acá."
          />
        }
      />
    </View>
  );
}
