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
import * as repo from '../db/messages';
import * as notify from '../notifications';
import { deviceTimezone, wallToUtc } from '../domain/time';
import { snoozeOneHour } from '../domain/schedule';
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
  /** Mensaje que se abrió en WhatsApp y todavía no confirmamos si salió. */
  awaitingConfirmation: ScheduledMessage | null;
  undo: PendingUndo | null;

  createMessage: (input: NewMessageInput) => Promise<ScheduledMessage>;
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

  const timezone = useMemo(() => deviceTimezone(), []);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Id que dejamos "en el aire" al saltar a WhatsApp, para preguntar al volver. */
  const openedId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setMessages(await repo.listAll());
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
      await reconcile();
      if (cancelled) return;
      setPermission(perm);
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
      await repo.setStatus(id, 'sent');
      setAwaitingConfirmation(null);
      await refresh();
    },
    [refresh],
  );

  const markSkipped = useCallback(
    async (id: string) => {
      const message = await repo.getById(id);
      await notify.cancel(message?.notificationId ?? null);
      await repo.setStatus(id, 'skipped');
      setAwaitingConfirmation(null);
      await refresh();
    },
    [refresh],
  );

  const dismissConfirmation = useCallback(() => {
    setAwaitingConfirmation(null);
    openedId.current = null;
  }, []);

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
          if (response.actionIdentifier === notify.ACTION_SNOOZE) {
            await rescheduleMessage(id, snoozeOneHour(timezone));
            return;
          }
          await openInWhatsApp(id);
        })();
      },
    );
    return () => sub.remove();
  }, [openInWhatsApp, rescheduleMessage, timezone]);

  /** Cuando el aviso suena con la app abierta, dejamos el mensaje como disparado. */
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const id = notify.extractMessageId(notification);
      if (!id) return;
      void (async () => {
        await repo.setStatus(id, 'fired');
        await refresh();
      })();
    });
    return () => sub.remove();
  }, [refresh]);

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
      awaitingConfirmation,
      undo,
      createMessage,
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
    };
  }, [
    awaitingConfirmation,
    confirmSent,
    createMessage,
    deleteMessage,
    dismissConfirmation,
    dismissUndo,
    duplicateMessage,
    editMessage,
    ensurePermission,
    markSkipped,
    messages,
    openInWhatsApp,
    permission,
    ready,
    refresh,
    rescheduleMessage,
    timezone,
    undo,
    undoDelete,
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
