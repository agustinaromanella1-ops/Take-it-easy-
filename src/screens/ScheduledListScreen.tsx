import React, { useMemo } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { groupByDay, pendingCountLabel, type DaySection } from '../domain/grouping';
import type { ScheduledMessage } from '../domain/types';
import { useMessages } from '../state/MessagesContext';
import { radius, spacing, usePalette } from '../theme';
import { MessageCard } from '../components/MessageCard';
import { ConfirmSentSheet, PermissionBanner, UndoToast } from '../components/Banners';
import { EmptyState } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ScheduledListScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const {
    pending,
    drafts,
    timezone,
    permission,
    undo,
    undoDelete,
    dismissUndo,
    awaitingConfirmation,
    confirmSent,
    markSkipped,
    dismissConfirmation,
    ensurePermission,
  } = useMessages();

  const sections = useMemo<DaySection[]>(() => {
    const grouped = groupByDay(pending, timezone);
    if (drafts.length > 0) {
      grouped.push({
        key: 'drafts',
        title: 'Sin programar',
        overdue: false,
        data: drafts,
      });
    }
    return grouped;
  }, [drafts, pending, timezone]);

  const openDetail = (m: ScheduledMessage) =>
    navigation.navigate('Detail', { id: m.id });

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{
          padding: spacing(2),
          paddingBottom: insets.bottom + spacing(12),
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing(2) }}>
            <Text
              style={{
                color: p.text,
                fontSize: 30,
                fontWeight: '800',
                letterSpacing: -0.5,
              }}
            >
              Programados
            </Text>
            <Text
              style={{ color: p.textMuted, fontSize: 15, marginTop: spacing(0.5) }}
            >
              {pendingCountLabel(pending.length)}
            </Text>
            {permission !== 'granted' ? (
              <View style={{ marginTop: spacing(2) }}>
                <PermissionBanner
                  denied={permission === 'denied'}
                  onRequest={() => void ensurePermission()}
                />
              </View>
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text
            style={{
              color: section.overdue ? p.warning : p.textMuted,
              fontSize: 13,
              fontWeight: '800',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginTop: spacing(1.5),
              marginBottom: spacing(1),
            }}
          >
            {section.title}
          </Text>
        )}
        renderItem={({ item, section }) => (
          <MessageCard
            message={item}
            overdue={section.overdue}
            trailing="Sin fecha"
            onPress={() => openDetail(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no hay nada esperando"
            detail="Escribí un mensaje ahora y elegí cuándo querés mandarlo. Te avisamos en el momento justo."
          />
        }
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nuevo mensaje"
        onPress={() => navigation.navigate('Compose')}
        style={({ pressed }) => ({
          position: 'absolute',
          right: spacing(2.5),
          bottom: insets.bottom + spacing(2.5),
          backgroundColor: p.accent,
          borderRadius: radius.pill,
          paddingVertical: spacing(2),
          paddingHorizontal: spacing(3),
          opacity: pressed ? 0.85 : 1,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        })}
      >
        <Text style={{ color: p.accentText, fontSize: 16, fontWeight: '800' }}>
          ＋  Nuevo mensaje
        </Text>
      </Pressable>

      {undo ? (
        <UndoToast onUndo={() => void undoDelete()} onDismiss={dismissUndo} />
      ) : null}

      {awaitingConfirmation ? (
        <ConfirmSentSheet
          message={awaitingConfirmation}
          onSent={() => void confirmSent(awaitingConfirmation.id)}
          onSkipped={() => void markSkipped(awaitingConfirmation.id)}
          onDismiss={dismissConfirmation}
        />
      ) : null}
    </View>
  );
}
