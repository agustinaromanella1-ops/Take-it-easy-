import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { groupByDay, pendingCountLabel, type DaySection } from '../domain/grouping';
import type { ScheduledMessage } from '../domain/types';
import { useMessages } from '../state/MessagesContext';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { MessageCard } from '../components/MessageCard';
import { ConfirmSentSheet, PermissionBanner, UndoToast } from '../components/Banners';
import { ReliabilityBanner } from '../components/Reliability';
import {
  AvisoDeVersion,
  BotonAyuda,
  ConsejoDePantalla,
  HojaDeAyuda,
} from '../components/Ayuda';
import { EmptyState, HardShadow, Title, Txt } from '../components/ui';
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
    reliability,
    hayVersionNueva,
    publicacion,
  } = useMessages();
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

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
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
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
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: spacing(2),
              }}
            >
              <View style={{ flex: 1 }}>
                <Title>Programados</Title>
                <Txt
                  style={{
                    color: p.textMuted,
                    fontSize: 15,
                    marginTop: spacing(0.5),
                  }}
                >
                  {pendingCountLabel(pending.length)}
                </Txt>
              </View>
              <BotonAyuda onPress={() => setAyudaAbierta(true)} />
            </View>
            {permission !== 'granted' ? (
              <View style={{ marginTop: spacing(2) }}>
                <PermissionBanner
                  denied={permission === 'denied'}
                  onRequest={() => void ensurePermission()}
                />
              </View>
            ) : (
              <ReliabilityBanner reliability={reliability} />
            )}

            {hayVersionNueva && publicacion ? (
              <AvisoDeVersion publicacion={publicacion} />
            ) : null}

            <ConsejoDePantalla pantalla="programados" />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Txt
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
          </Txt>
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

      <HardShadow
        size="md"
        corner={radius.pill}
        style={{
          position: 'absolute',
          right: spacing(2.5),
          bottom: insets.bottom + spacing(3),
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuevo mensaje"
          onPress={() => navigation.navigate('Compose')}
          style={({ pressed }) => ({
            backgroundColor: p.primary,
            borderRadius: radius.pill,
            borderWidth: BORDER_WIDTH,
            borderColor: p.border,
            paddingVertical: spacing(1.75),
            paddingHorizontal: spacing(3),
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Txt style={{ color: p.primaryText, fontSize: 16, fontWeight: '700' }}>
            ＋  Nuevo mensaje
          </Txt>
        </Pressable>
      </HardShadow>

      {undo ? (
        <UndoToast onUndo={() => void undoDelete()} onDismiss={dismissUndo} />
      ) : null}

      <HojaDeAyuda
        visible={ayudaAbierta}
        onCerrar={() => setAyudaAbierta(false)}
      />

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
