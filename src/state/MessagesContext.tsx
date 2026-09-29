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
  aMilisegundos,
  assessReliability,
  recordSample,
  type DeliverySample,
  type Reliability,
} from '../domain/reliability';
import { parseBackup, serializeBackup } from '../domain/backup';
import { setThemePreference, type ThemePreference } from '../theme';
import type { Template } from '../domain/templates';
import { whatsappSchemeUrl, whatsappWebUrl } from '../domain/whatsapp';
import type { NewMessageInput, ScheduledMessage } from '../domain/types';
import { awaitsNotification, isDone, isPending } from '../domain/types';

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
  /**
   * Cuántos avisos tiene agendados el sistema. Comparado con los pendientes,
   * dice de quién es el problema cuando un mensaje no suena.
   */
  osScheduled: number | null;
  /** Cuántos avisos deberían estar agendados, para comparar con el sistema. */
  awaitingNotification: number;
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
    patch: {
      body?: string;
      phoneE164?: string;
      contactName?: string | null;
      recurrenceRule?: string | null;
      /** Nueva hora de pared, si cambió. */
      localAt?: string | null;
    },
  ) => Promise<void>;
  rescheduleMessage: (id: string, localAt: string) => Promise<void>;
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
  updateTheme: (valor: ThemePreference) => Promise<void>;

  exportBackup: () => Promise<void>;
  importBackup: () => Promise<{ messages: number; templates: number } | null>;

  completeOnboarding: () => Promise<void>;
  checkScheduled: () => Promise<void>;
  testNotification: (seconds: number) => Promise<notify.PermissionState>;
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
  const [osScheduled, setOsScheduled] = useState<number | null>(null);

  const timezone = useMemo(() => deviceTimezone(), []);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ensurePermission se define más abajo; la ref evita reordenar el archivo. */
  const ensurePermissionRef = useRef<() => Promise<notify.PermissionState>>(
    async () => 'undetermined',
  );
  /** Id que dejamos "en el aire" al saltar a WhatsApp, para preguntar al volver. */
  const openedId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const [allMessages, allTemplates] = await Promise.all([
      repo.listAll(),
      templatesRepo.listTemplates(),
    ]);
    setMessages(allMessages);
    setTemplates(allTemplates);
    try {
      setOsScheduled(await notify.scheduledCount());
    } catch {
      setOsScheduled(null);
    }
  }, []);

  const checkScheduled = useCallback(async () => {
    try {
      setOsScheduled(await notify.scheduledCount());
    } catch {
      setOsScheduled(null);
    }
  }, []);

  /**
   * Devuelve el estado del permiso en lugar de agendar a ciegas: sin permiso
   * nada falla, y la app terminaría diciendo "si llega, funciona" cuando lo
   * que pasa es que el aviso no puede aparecer.
   */
  const testNotification = useCallback(
    async (seconds: number): Promise<notify.PermissionState> => {
      const permiso = await ensurePermissionRef.current();
      if (permiso !== 'granted') return permiso;
      await notify.scheduleTest(seconds);
      await checkScheduled();
      return permiso;
    },
    [checkScheduled],
  );

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
      const [hours, samples, onboarded, tema] = await Promise.all([
        settingsRepo.loadQuietHours(),
        settingsRepo.loadDeliverySamples(),
        settingsRepo.loadOnboardingCompleted(),
        settingsRepo.loadThemePreference(),
      ]);
      // Antes de marcar la app como lista, así no se dibuja un cuadro en
      // claro y salta a oscuro.
      setThemePreference(tema);
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

  // Mutar una ref durante el dibujado es un antipatrón aunque acá sea
  // inofensivo: va en un efecto.
  useEffect(() => {
    ensurePermissionRef.current = ensurePermission;
  }, [ensurePermission]);

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
        recurrenceRule?: string | null;
        localAt?: string | null;
      },
    ) => {
      const { localAt, ...campos } = patch;

      const anterior = await repo.getById(id);
      await notify.cancel(anterior?.notificationId ?? null);

      await repo.update(id, campos);
      // La hora va junto con el resto en una sola pasada. Reagendar por
      // separado programaba un aviso a la hora vieja para cancelarlo al
      // instante y programar un tercero: dos llamadas al sistema de más y un
      // rato con un aviso a una hora que ya se había cambiado.
      if (localAt !== undefined && localAt !== null) {
        await repo.reschedule(id, localAt, timezone);
      }

      // El texto y el destinatario viajan en la notificación, así que se
      // reagenda aunque solo haya cambiado el mensaje.
      const updated = await repo.getById(id);
      if (updated && updated.status === 'scheduled') {
        const notificationId = await notify.scheduleFor(updated);
        await repo.update(id, { notificationId });
      }
      await refresh();
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

      // Un borrador no tiene fecha, y 'fired' sin fecha no cae en ninguna
      // lista: el mensaje desaparecería de la pantalla. Abrir WhatsApp desde
      // un borrador no cambia su estado.
      if (message.status !== 'draft') {
        await repo.setStatus(id, 'fired');
      }
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

      // Marcar enviado un mensaje cuya hora todavía no llegó tiene que
      // cancelar su aviso: si no, suena igual más tarde y al tocarlo el
      // mensaje vuelve a salir del historial.
      await notify.cancel(message.notificationId);

      if (next) {
        // Recurrente: guardamos esta salida en el historial y adelantamos el
        // mensaje vivo a la próxima repetición.
        await repo.archiveOccurrence(message);
        await repo.reschedule(id, next, message.timezone);

        const updated = await repo.getById(id);
        if (updated) {
          const notificationId = await notify.scheduleFor(updated);
          await repo.update(id, { notificationId });
        }
      } else {
        await repo.update(id, { notificationId: null });
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
        await repo.update(id, { notificationId: null });
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
        deliveredAt: new Date(aMilisegundos(deliveredAtMs)).toISOString(),
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

  const updateTheme = useCallback(async (valor: ThemePreference) => {
    // Primero se aplica y después se guarda: la pantalla tiene que cambiar en
    // el acto, no cuando conteste la base.
    setThemePreference(valor);
    await settingsRepo.saveThemePreference(valor);
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

    // Los ids de aviso de antes de importar. Se cancelan DESPUÉS de que la
    // importación salga bien: si se cancelaran primero y la transacción
    // fallara, la base quedaría intacta pero sin ningún aviso agendado.
    const previos = (await repo.listAll()).map((m) => m.notificationId);

    await repo.replaceAllMessages(backup.messages);
    await templatesRepo.replaceAllTemplates(backup.templates);

    for (const id of previos) {
      await notify.cancel(id);
    }
    // Y se limpian los ids de TODAS las filas, no solo de las que el archivo
    // pisó: una fila que el backup no traía conserva un id ya cancelado, y
    // con ese id puesto reconcile la da por agendada y no vuelve a agendarla.
    await repo.clearAllNotificationIds();

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
        // Se pregunta porque fuimos nosotros los que abrimos WhatsApp, no por
        // el estado: un borrador no pasa a 'fired' y así igual se confirma.
        const message = await repo.getById(id);
        if (message && !isDone(message)) {
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
      osScheduled,
      awaitingNotification: messages.filter((m) => awaitsNotification(m)).length,
      awaitingConfirmation,
      undo,
      createMessage,
      createForMany,
      editMessage,
      rescheduleMessage,
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
      updateTheme,
      exportBackup,
      importBackup,
      completeOnboarding,
      checkScheduled,
      testNotification,
    };
  }, [
    awaitingConfirmation,
    checkScheduled,
    completeOnboarding,
    confirmSent,
    createForMany,
    deliverySamples,
    createMessage,
    deleteMessage,
    deleteTemplate,
    dismissConfirmation,
    dismissUndo,
    editMessage,
    editTemplate,
    ensurePermission,
    exportBackup,
    importBackup,
    markSkipped,
    messages,
    onboardingCompleted,
    openInWhatsApp,
    osScheduled,
    permission,
    quietHours,
    ready,
    refresh,
    rescheduleMessage,
    saveTemplate,
    templates,
    testNotification,
    timezone,
    undo,
    undoDelete,
    updateQuietHours,
    updateTheme,
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
