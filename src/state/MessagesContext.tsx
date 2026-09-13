import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as repo from '../db/messages';
import * as templatesRepo from '../db/templates';
import * as settingsRepo from '../db/settings';
import * as notify from '../notifications';
import { deviceTimezone, wallToUtc } from '../domain/time';
import { snoozeOneHour } from '../domain/schedule';
import { nextOccurrence } from '../domain/recurrence';
import { DEFAULT_QUIET_HOURS, type QuietHours } from '../domain/quietHours';
import {
  assessReliability,
  recordSample,
  type DeliverySample,
  type Reliability,
} from '../domain/reliability';
import { parseBackup, serializeBackup } from '../domain/backup';
import type { Template } from '../domain/templates';
import { whatsappSchemeUrl, whatsappWebUrl } from '../domain/whatsapp';
import type { NewMessageInput, ScheduledMessage } from '../domain/types';
import { isDone, isPending } from '../domain/types';

interface PendingUndo {
  message: ScheduledMessage;
  expiresAt: number;
}

interface MessagesValue {
  ready: boolean;
  messages: ScheduledMessage[];
  pending: ScheduledMessage[];
  drafts: ScheduledMessage[];
  history: ScheduledMessage[];
  timezone: string;
  permission: notify.PermissionState;
  templates: Template[];
  quietHours: QuietHours;
  /** Qué tan a horario vienen llegando los avisos en este teléfono. */
  reliability: Reliability;
  onboardingCompleted: boolean;
  /** Mensaje que se abrió en WhatsApp y todavía no confirmamos si salió. */
  awaitingConfirmation: ScheduledMessage | null;
  undo: PendingUndo | null;

  createMessage: (input: NewMessageInput) => Promise<ScheduledMessage>;
  /** Un mensaje individual por destinatario: nunca una difusión. */
  createForMany: (
    recipients: { name: string | null; e164: string }[],
    input: Omit<NewMessageInput, 'phoneE164' | 'contactName'>,
  ) => Promise<number>;
  editMessage: (
    id: string,
    patch: { body?: string; phoneE164?: string; contactName?: string | null },
  ) => Promise<void>;
  rescheduleMessage: (id: string, localAt: string) => Promise<void>;
  duplicateMessage: (id: string) => Promise<ScheduledMessage | null>;
  deleteMessage: (id: string) => Promise<void>;
  undoDelete: () => Promise<void>;
  dismissUndo: () => void;
  openInWhatsApp: (id: string) => Promise<void>;
  confirmSent: (id: string) => Promise<void>;
  markSkipped: (id: string) => Promise<void>;
  dismissConfirmation: () => void;
  ensurePermission: () => Promise<notify.PermissionState>;
  refresh: () => Promise<void>;

  saveTemplate: (name: string, body: string) => Promise<void>;
  editTemplate: (
    id: string,
    patch: { name?: string; body?: string },
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  updateQuietHours: (hours: QuietHours) => Promise<void>;

  exportBackup: () => Promise<void>;
  importBackup: () => Promise<{ messages: number; templates: number } | null>;

  completeOnboarding: () => Promise<void>;
}

const MessagesContext = createContext<MessagesValue | null>(null);

const UNDO_WINDOW_MS = 6000;

export function MessagesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [permission, setPermission] =
    useState<notify.PermissionState>('undetermined');
  const [awaitingConfirmation, setAwaitingConfirmation] =
    useState<ScheduledMessage | null>(null);
  const [undo, setUndo] = useState<PendingUndo | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [quietHours, setQuietHours] = useState<QuietHours>(DEFAULT_QUIET_HOURS);
  const [deliverySamples, setDeliverySamples] = useState<DeliverySample[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);

  const timezone = useMemo(() => deviceTimezone(), []);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Id que dejamos "en el aire" al saltar a WhatsApp, para preguntar al volver. */
  const openedId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [allMessages, allTemplates] = await Promise.all([
      repo.listAll(),
      templatesRepo.listTemplates(),
    ]);
    setMessages(allMessages);
    setTemplates(allTemplates);
  }, []);

  /**
   * Al arrancar recalculamos el instante UTC de cada pendiente a partir de la
   * hora de pared. Si el huso cambió de reglas, el mensaje sigue saliendo a la
   * hora local que se eligió, y reagendamos la notificación que corresponda.
   */
  const reconcile = useCallback(async () => {
    const all = await repo.listAll();
    for (const m of all) {
      if (m.status !== 'scheduled' || !m.localAt) continue;

      const expected = wallToUtc(m.localAt, m.timezone).toISOString();
      const drifted = expected !== m.scheduledAt;
      const future = new Date(expected).getTime() > Date.now();

      if (drifted) {
        await repo.update(m.id, { scheduledAt: expected });
      }
      if (drifted || (!m.notificationId && future)) {
        await notify.cancel(m.notificationId);
        const notificationId = await notify.scheduleFor({
          ...m,
          scheduledAt: expected,
        });
        await repo.update(m.id, { notificationId });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await notify.configure();
      const perm = await notify.getPermission();
      const [hours, samples, onboarded] = await Promise.all([
        settingsRepo.loadQuietHours(),
        settingsRepo.loadDeliverySamples(),
        settingsRepo.loadOnboardingCompleted(),
      ]);
      await reconcile();
      if (cancelled) return;
      setPermission(perm);
      setQuietHours(hours);
      setDeliverySamples(samples);
      setOnboardingCompleted(onboarded);
      await refresh();
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [reconcile, refresh]);

  const rescheduleMessage = useCallback(
    async (id: string, localAt: string) => {
      const current = await repo.getById(id);
      if (!current) return;

      // Cancelamos la notificación vieja antes de agendar la nueva: si no,
      // llegarían dos avisos para el mismo mensaje.
      await notify.cancel(current.notificationId);
      await repo.reschedule(id, localAt, timezone);

      const updated = await repo.getById(id);
      if (updated) {
        const notificationId = await notify.scheduleFor(updated);
        await repo.update(id, { notificationId });
      }
      await refresh();
    },
    [refresh, timezone],
  );

  const ensurePermission = useCallback(async () => {
    const current = await notify.getPermission();
    if (current === 'granted') {
      setPermission('granted');
      return current;
    }
    const next =
      current === 'undetermined' ? await notify.requestPermission() : current;
    setPermission(next);
    return next;
  }, []);

  const createMessage = useCallback(
    async (input: NewMessageInput) => {
      const message = await repo.create({ ...input, timezone });

      if (message.status === 'scheduled') {
        await ensurePermission();
        const notificationId = await notify.scheduleFor(message);
        await repo.update(message.id, { notificationId });
        message.notificationId = notificationId;
      }

      await refresh();
      return message;
    },
    [ensurePermission, refresh, timezone],
  );

  /**
   * Un mensaje por persona, cada uno con su propia notificación. No es una
   * difusión: si después editás o cancelás uno, los demás no se tocan.
   */
  const createForMany = useCallback(
    async (
      recipients: { name: string | null; e164: string }[],
      input: Omit<NewMessageInput, 'phoneE164' | 'contactName'>,
    ) => {
      for (const recipient of recipients) {
        await createMessage({
          ...input,
          phoneE164: recipient.e164,
          contactName: recipient.name,
        });
      }
      return recipients.length;
    },
    [createMessage],
  );

  const editMessage = useCallback(
    async (
      id: string,
      patch: {
        body?: string;
        phoneE164?: string;
        contactName?: string | null;
      },
    ) => {
      await repo.update(id, patch);
      // El texto viaja en la notificación, así que la reagendamos para que el
      // aviso muestre lo que realmente se va a mandar.
      const updated = await repo.getById(id);
      if (updated && updated.status === 'scheduled') {
        await notify.cancel(updated.notificationId);
        const notificationId = await notify.scheduleFor(updated);
        await repo.update(id, { notificationId });
      }
      await refresh();
    },
    [refresh],
  );

  const duplicateMessage = useCallback(
    async (id: string) => {
      const source = await repo.getById(id);
      if (!source) return null;
      const copy = await repo.create({
        contactName: source.contactName,
        phoneE164: source.phoneE164,
        body: source.body,
        localAt: null, // la copia arranca sin fecha: se decide destinatario y momento
        timezone,
      });
      await refresh();
      return copy;
    },
    [refresh, timezone],
  );

  const dismissUndo = useCallback(() => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndo(null);
  }, []);

  const deleteMessage = useCallback(
    async (id: string) => {
      const message = await repo.getById(id);
      if (!message) return;

      await notify.cancel(message.notificationId);
      await repo.remove(id);
      await refresh();

      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({ message, expiresAt: Date.now() + UNDO_WINDOW_MS });
      undoTimer.current = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
    },
    [refresh],
  );

  const undoDelete = useCallback(async () => {
    const pendingUndo = undo;
    dismissUndo();
    if (!pendingUndo) return;

    await repo.restore(pendingUndo.message);
    if (pendingUndo.message.status === 'scheduled') {
      const notificationId = await notify.scheduleFor(pendingUndo.message);
      await repo.update(pendingUndo.message.id, { notificationId });
    }
    await refresh();
  }, [dismissUndo, refresh, undo]);

  const openInWhatsApp = useCallback(
    async (id: string) => {
      const message = await repo.getById(id);
      if (!message) return;

      const scheme = whatsappSchemeUrl(message.phoneE164, message.body);
      const web = whatsappWebUrl(message.phoneE164, message.body);

      openedId.current = id;
      try {
        const canOpen = await Linking.canOpenURL(scheme);
        await Linking.openURL(canOpen ? scheme : web);
      } catch {
        await Linking.openURL(web);
      }

      await repo.setStatus(id, 'fired');
      await refresh();
    },
    [refresh],
  );

  const confirmSent = useCallback(
    async (id: string) => {
      const message = await repo.getById(id);
      if (!message) return;

      const next = message.localAt
        ? nextOccurrence(message.localAt, message.recurrenceRule, timezone)
        : null;

      if (next) {
        // Recurrente: guardamos esta salida en el historial y adelantamos el
        // mensaje vivo a la próxima repetición.
        await repo.archiveOccurrence(message);
        await notify.cancel(message.notificationId);
        await repo.reschedule(id, next, message.timezone);

        const updated = await repo.getById(id);
        if (updated) {
          const notificationId = await notify.scheduleFor(updated);
          await repo.update(id, { notificationId });
        }
      } else {
        await repo.setStatus(id, 'sent');
      }

      setAwaitingConfirmation(null);
      await refresh();
    },
    [refresh, timezone],
  );

  const markSkipped = useCallback(
    async (id: string) => {
      const message = await repo.getById(id);
      if (!message) return;

      await notify.cancel(message.notificationId);

      const next = message.localAt
        ? nextOccurrence(message.localAt, message.recurrenceRule, timezone)
        : null;

      if (next) {
        // En un recurrente, saltear es saltear *esta* vez: la serie sigue.
        // Para cortarla del todo está "Cancelar mensaje" en el detalle.
        await repo.archiveOccurrence({ ...message, status: 'skipped' });
        await repo.reschedule(id, next, message.timezone);

        const updated = await repo.getById(id);
        if (updated) {
          const notificationId = await notify.scheduleFor(updated);
          await repo.update(id, { notificationId });
        }
      } else {
        await repo.setStatus(id, 'skipped');
      }

      setAwaitingConfirmation(null);
      await refresh();
    },
    [refresh, timezone],
  );

  const dismissConfirmation = useCallback(() => {
    setAwaitingConfirmation(null);
    openedId.current = null;
  }, []);

  const saveTemplate = useCallback(
    async (name: string, body: string) => {
      await templatesRepo.createTemplate(name.trim(), body);
      await refresh();
    },
    [refresh],
  );

  const editTemplate = useCallback(
    async (id: string, patch: { name?: string; body?: string }) => {
      await templatesRepo.updateTemplate(id, patch);
      await refresh();
    },
    [refresh],
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      await templatesRepo.removeTemplate(id);
      await refresh();
    },
    [refresh],
  );

  const completeOnboarding = useCallback(async () => {
    await settingsRepo.saveOnboardingCompleted(true);
    setOnboardingCompleted(true);
  }, []);

  /**
   * Guarda cuánto tardó en llegar un aviso respecto de su hora. Las dos vías
   * (el aviso que suena con la app viva y el toque sobre la notificación)
   * reportan la misma marca de tiempo del sistema, así que descartamos la
   * repetida en vez de contar dos veces la misma entrega.
   */
  const recordDelivery = useCallback(
    async (expectedAt: string | null, deliveredAtMs: number) => {
      if (!expectedAt) return;
      const sample: DeliverySample = {
        expectedAt,
        deliveredAt: new Date(deliveredAtMs).toISOString(),
      };

      const stored = await settingsRepo.loadDeliverySamples();
      const alreadySeen = stored.some(
        (s) =>
          s.expectedAt === sample.expectedAt &&
          s.deliveredAt === sample.deliveredAt,
      );
      if (alreadySeen) return;

      const next = recordSample(stored, sample);
      await settingsRepo.saveDeliverySamples(next);
      setDeliverySamples(next);
    },
    [],
  );

  const updateQuietHours = useCallback(async (hours: QuietHours) => {
    await settingsRepo.saveQuietHours(hours);
    setQuietHours(hours);
  }, []);

  /**
   * El backup es un archivo que sale por el share sheet del sistema: la usuaria
   * elige dónde guardarlo. No hay servidor de por medio, igual que el resto.
   */
  const exportBackup = useCallback(async () => {
    const [allMessages, allTemplates] = await Promise.all([
      repo.listAll(),
      templatesRepo.listTemplates(),
    ]);
    const json = serializeBackup(allMessages, allTemplates);
    const stamp = new Date().toISOString().slice(0, 10);
    const uri = `${FileSystem.cacheDirectory}listo-para-enviar-${stamp}.json`;

    await FileSystem.writeAsStringAsync(uri, json);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Guardar backup',
      });
    }
  }, []);

  const importBackup = useCallback(async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    const file = picked.assets?.[0];
    if (picked.canceled || !file) return null;

    const raw = await FileSystem.readAsStringAsync(file.uri);
    // parseBackup valida la forma antes de tocar la base: si el archivo está
    // roto, tira un error entendible y no se importa nada a medias.
    const backup = parseBackup(raw);

    await repo.replaceAllMessages(backup.messages);
    await templatesRepo.replaceAllTemplates(backup.templates);
    // Los mensajes importados llegan sin notificación agendada; reconcile les
    // vuelve a poner una a los que siguen siendo futuros.
    await reconcile();
    await refresh();

    return {
      messages: backup.messages.length,
      templates: backup.templates.length,
    };
  }, [reconcile, refresh]);

  /**
   * Al volver de WhatsApp preguntamos una sola vez si el mensaje salió.
   * Si la usuaria cierra el cartel sin responder, no volvemos a insistir.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const id = openedId.current;
      openedId.current = null;
      if (!id) {
        void refresh();
        return;
      }
      void (async () => {
        const message = await repo.getById(id);
        if (message && message.status === 'fired') {
          setAwaitingConfirmation(message);
        }
        await refresh();
      })();
    });
    return () => sub.remove();
  }, [refresh]);

  /** Toques y acciones sobre la notificación. */
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const id = notify.extractMessageId(response.notification);
        if (!id) return;

        void (async () => {
          const message = await repo.getById(id);
          await recordDelivery(
            message?.scheduledAt ?? null,
            response.notification.date,
          );

          if (response.actionIdentifier === notify.ACTION_SNOOZE) {
            await rescheduleMessage(id, snoozeOneHour(timezone));
            return;
          }
          await openInWhatsApp(id);
        })();
      },
    );
    return () => sub.remove();
  }, [openInWhatsApp, recordDelivery, rescheduleMessage, timezone]);

  /** Cuando el aviso suena con la app abierta, dejamos el mensaje como disparado. */
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const id = notify.extractMessageId(notification);
      if (!id) return;
      void (async () => {
        const message = await repo.getById(id);
        await recordDelivery(message?.scheduledAt ?? null, notification.date);
        await repo.setStatus(id, 'fired');
        await refresh();
      })();
    });
    return () => sub.remove();
  }, [recordDelivery, refresh]);

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const value = useMemo<MessagesValue>(() => {
    const pending = messages.filter(isPending);
    return {
      ready,
      messages,
      pending,
      drafts: messages.filter((m) => m.status === 'draft'),
      history: messages.filter(isDone),
      timezone,
      permission,
      templates,
      quietHours,
      reliability: assessReliability(deliverySamples),
      onboardingCompleted,
      awaitingConfirmation,
      undo,
      createMessage,
      createForMany,
      editMessage,
      rescheduleMessage,
      duplicateMessage,
      deleteMessage,
      undoDelete,
      dismissUndo,
      openInWhatsApp,
      confirmSent,
      markSkipped,
      dismissConfirmation,
      ensurePermission,
      refresh,
      saveTemplate,
      editTemplate,
      deleteTemplate,
      updateQuietHours,
      exportBackup,
      importBackup,
      completeOnboarding,
    };
  }, [
    awaitingConfirmation,
    completeOnboarding,
    confirmSent,
    createForMany,
    deliverySamples,
    createMessage,
    deleteMessage,
    deleteTemplate,
    dismissConfirmation,
    dismissUndo,
    duplicateMessage,
    editMessage,
    editTemplate,
    ensurePermission,
    exportBackup,
    importBackup,
    markSkipped,
    messages,
    onboardingCompleted,
    openInWhatsApp,
    permission,
    quietHours,
    ready,
    refresh,
    rescheduleMessage,
    saveTemplate,
    templates,
    timezone,
    undo,
    undoDelete,
    updateQuietHours,
  ]);

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages(): MessagesValue {
  const ctx = useContext(MessagesContext);
  if (!ctx) {
    throw new Error('useMessages debe usarse dentro de <MessagesProvider>');
  }
  return ctx;
}
