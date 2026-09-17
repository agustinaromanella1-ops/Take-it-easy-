import type { AppData, Borrados, Lapida, Patient, Payment, Session, Settings } from '../types';
import { newId } from '../lib/id';
import { today as todayISO } from '../lib/dates';

/**
 * El momento exacto de este cambio.
 *
 * Todo lo que se crea o se modifica queda sellado con la hora, y todo lo que
 * se borra deja su lápida. No es para mostrar en pantalla: es lo que va a
 * permitir, el día que la app sincronice entre dispositivos, saber cuál de dos
 * versiones del mismo registro es la buena. Ver SINCRONIZACION.md.
 */
const ahora = (): string => new Date().toISOString();

/** Sella un registro con la hora de este cambio. */
function sellar<T extends object>(registro: T): T & { updatedAt: string } {
  return { ...registro, updatedAt: ahora() };
}

/** Suma lápidas a lo ya borrado, sin repetir ids. */
function enterrar(previos: Lapida[], ids: string[], cuando: string): Lapida[] {
  if (ids.length === 0) return previos;
  const nuevos = new Set(ids);
  return [...previos.filter((l) => !nuevos.has(l.id)), ...ids.map((id) => ({ id, deletedAt: cuando }))];
}

/** Las tres listas de borrados, por si vinieran de datos viejos sin ellas. */
function borrados(state: AppData): Borrados {
  return state.deleted ?? { patients: [], sessions: [], payments: [] };
}

export type Action =
  | { type: 'patient/add'; payload: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'patient/update'; payload: Patient }
  | { type: 'patient/remove'; payload: { id: string } }
  | { type: 'session/add'; payload: Omit<Session, 'id' | 'updatedAt'> }
  | { type: 'session/addMany'; payload: Omit<Session, 'id' | 'updatedAt'>[] }
  | { type: 'session/update'; payload: Session }
  | { type: 'session/remove'; payload: { id: string } }
  | { type: 'session/setStatus'; payload: { id: string; status: Session['status'] } }
  | { type: 'payment/add'; payload: Omit<Payment, 'id' | 'updatedAt'> }
  | {
      type: 'day/close';
      payload: {
        updates: { id: string; status: Session['status']; chargeable: boolean }[];
        payments: Omit<Payment, 'id' | 'updatedAt'>[];
      };
    }
  | { type: 'payment/remove'; payload: { id: string } }
  | { type: 'settings/update'; payload: Partial<Settings> }
  | { type: 'data/replace'; payload: AppData };

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'patient/add':
      return {
        ...state,
        patients: [...state.patients, sellar({ ...action.payload, id: newId(), createdAt: ahora() })],
      };

    case 'patient/update':
      return {
        ...state,
        patients: state.patients.map((p) => {
          if (p.id !== action.payload.id) return p;
          // Si cambió el honorario, se registra la fecha del aumento sola: nadie
          // se acuerda de cuándo actualizó la tarifa de cada paciente.
          const changedFee = p.defaultFee !== action.payload.defaultFee;
          return sellar(changedFee ? { ...action.payload, lastRaise: todayISO() } : action.payload);
        }),
      };

    case 'patient/remove': {
      // Borrar un paciente arrastra sus sesiones y pagos. Dejarlos sueltos
      // produciría ingresos fantasma en los reportes, imposibles de rastrear.
      const { id } = action.payload;
      const cuando = ahora();
      const sesionesCaidas = state.sessions.filter((s) => s.patientId === id).map((s) => s.id);
      const pagosCaidos = state.payments.filter((p) => p.patientId === id).map((p) => p.id);
      const previos = borrados(state);
      return {
        ...state,
        patients: state.patients.filter((p) => p.id !== id),
        sessions: state.sessions.filter((s) => s.patientId !== id),
        payments: state.payments.filter((p) => p.patientId !== id),
        // Lo arrastrado también deja su marca: si no, otro dispositivo
        // devolvería las sesiones de un paciente que ya no existe.
        deleted: {
          patients: enterrar(previos.patients, [id], cuando),
          sessions: enterrar(previos.sessions, sesionesCaidas, cuando),
          payments: enterrar(previos.payments, pagosCaidos, cuando),
        },
      };
    }

    case 'session/add':
      return { ...state, sessions: [...state.sessions, sellar({ ...action.payload, id: newId() })] };

    case 'session/addMany':
      // Una serie recurrente entra como un solo cambio de estado: si se
      // agregaran de a una, cada sesión dispararía un render y un guardado.
      return {
        ...state,
        sessions: [...state.sessions, ...action.payload.map((s) => sellar({ ...s, id: newId() }))],
      };

    case 'session/update':
      return {
        ...state,
        sessions: state.sessions.map((s) => (s.id === action.payload.id ? sellar(action.payload) : s)),
      };

    case 'session/remove':
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.payload.id),
        deleted: { ...borrados(state), sessions: enterrar(borrados(state).sessions, [action.payload.id], ahora()) },
      };

    case 'session/setStatus':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.payload.id ? sellar({ ...s, status: action.payload.status }) : s,
        ),
      };

    case 'payment/add':
      return { ...state, payments: [...state.payments, sellar({ ...action.payload, id: newId() })] };

    case 'day/close': {
      // El cierre entra como un solo cambio de estado: cerrar ocho sesiones y
      // registrar sus cobros de a uno dispararía dieciséis renders y guardados,
      // y dejaría estados intermedios donde una sesión está cerrada pero su
      // cobro todavía no existe.
      const { updates, payments } = action.payload;
      if (updates.length === 0 && payments.length === 0) return state;

      const byId = new Map(updates.map((u) => [u.id, u]));
      return {
        ...state,
        sessions: state.sessions.map((s) => {
          const update = byId.get(s.id);
          return update ? sellar({ ...s, status: update.status, chargeable: update.chargeable }) : s;
        }),
        payments: [...state.payments, ...payments.map((p) => sellar({ ...p, id: newId() }))],
      };
    }

    case 'payment/remove':
      return {
        ...state,
        payments: state.payments.filter((p) => p.id !== action.payload.id),
        deleted: { ...borrados(state), payments: enterrar(borrados(state).payments, [action.payload.id], ahora()) },
      };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'data/replace':
      return action.payload;

    default:
      return state;
  }
}
