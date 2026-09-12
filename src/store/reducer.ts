import type { AppData, Patient, Payment, Session, Settings } from '../types';
import { newId } from '../lib/id';
import { today as todayISO } from '../lib/dates';

export type Action =
  | { type: 'patient/add'; payload: Omit<Patient, 'id' | 'createdAt'> }
  | { type: 'patient/update'; payload: Patient }
  | { type: 'patient/remove'; payload: { id: string } }
  | { type: 'session/add'; payload: Omit<Session, 'id'> }
  | { type: 'session/addMany'; payload: Omit<Session, 'id'>[] }
  | { type: 'session/update'; payload: Session }
  | { type: 'session/remove'; payload: { id: string } }
  | { type: 'session/setStatus'; payload: { id: string; status: Session['status'] } }
  | { type: 'payment/add'; payload: Omit<Payment, 'id'> }
  | { type: 'payment/remove'; payload: { id: string } }
  | { type: 'settings/update'; payload: Partial<Settings> }
  | { type: 'data/replace'; payload: AppData };

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'patient/add':
      return {
        ...state,
        patients: [...state.patients, { ...action.payload, id: newId(), createdAt: new Date().toISOString() }],
      };

    case 'patient/update':
      return {
        ...state,
        patients: state.patients.map((p) => {
          if (p.id !== action.payload.id) return p;
          // Si cambió el honorario, se registra la fecha del aumento sola: nadie
          // se acuerda de cuándo actualizó la tarifa de cada paciente.
          const changedFee = p.defaultFee !== action.payload.defaultFee;
          return changedFee ? { ...action.payload, lastRaise: todayISO() } : action.payload;
        }),
      };

    case 'patient/remove': {
      // Borrar un paciente arrastra sus sesiones y pagos. Dejarlos sueltos
      // produciría ingresos fantasma en los reportes, imposibles de rastrear.
      const { id } = action.payload;
      return {
        ...state,
        patients: state.patients.filter((p) => p.id !== id),
        sessions: state.sessions.filter((s) => s.patientId !== id),
        payments: state.payments.filter((p) => p.patientId !== id),
      };
    }

    case 'session/add':
      return { ...state, sessions: [...state.sessions, { ...action.payload, id: newId() }] };

    case 'session/addMany':
      // Una serie recurrente entra como un solo cambio de estado: si se
      // agregaran de a una, cada sesión dispararía un render y un guardado.
      return {
        ...state,
        sessions: [...state.sessions, ...action.payload.map((s) => ({ ...s, id: newId() }))],
      };

    case 'session/update':
      return {
        ...state,
        sessions: state.sessions.map((s) => (s.id === action.payload.id ? action.payload : s)),
      };

    case 'session/remove':
      return { ...state, sessions: state.sessions.filter((s) => s.id !== action.payload.id) };

    case 'session/setStatus':
      return {
        ...state,
        sessions: state.sessions.map((s) =>
          s.id === action.payload.id ? { ...s, status: action.payload.status } : s,
        ),
      };

    case 'payment/add':
      return { ...state, payments: [...state.payments, { ...action.payload, id: newId() }] };

    case 'payment/remove':
      return { ...state, payments: state.payments.filter((p) => p.id !== action.payload.id) };

    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'data/replace':
      return action.payload;

    default:
      return state;
  }
}
