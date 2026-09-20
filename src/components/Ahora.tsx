import { useEffect, useMemo, useState } from 'react';
import type { Patient, Session } from '../types';
import { enPalabras, nombrarDia, queSigue, type Momento } from '../lib/ahora';
import { today } from '../lib/dates';
import { patientColor } from '../lib/palette';

/**
 * Lo que está pasando ahora, arriba de todo y en una sola línea grande.
 *
 * Tres decisiones que parecen de estilo y son de uso:
 *
 * - **Lo grande es la distancia, no la hora.** "Faltan 25 minutos" orienta;
 *   "15:00" hay que restarlo mentalmente, y esa resta es justo la que cuesta.
 * - **Una sola cosa.** Abajo está la agenda entera; acá va lo próximo y nada
 *   más. Una lista arriba de todo obliga a elegir antes de empezar.
 * - **Está siempre, aunque no haya nada.** Si el bloque desaparece los días
 *   libres, deja de ser un lugar fijo donde mirar y hay que buscarlo.
 */

/** Cada cuánto se vuelve a mirar el reloj. */
const LATIDO_MS = 20000;

/** Minutos transcurridos del día, que es como los cuenta `queSigue`. */
function minutosDeAhora(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Desde acá el cartel avisa que la cosa está por empezar. */
const UMBRAL_AVISO_MIN = 10;
/** Y desde acá, que la sesión está por terminar. */
const UMBRAL_CIERRE_MIN = 5;

export function Ahora({
  sessions,
  patientsById,
  onVerAgenda,
}: {
  sessions: Session[];
  patientsById: Map<string, Patient>;
  onVerAgenda: () => void;
}) {
  const [reloj, setReloj] = useState(() => ({ hoy: today(), minutos: minutosDeAhora() }));

  useEffect(() => {
    const t = window.setInterval(() => setReloj({ hoy: today(), minutos: minutosDeAhora() }), LATIDO_MS);
    return () => window.clearInterval(t);
  }, []);

  const momento = useMemo(
    () => queSigue(sessions, reloj.hoy, reloj.minutos),
    [sessions, reloj.hoy, reloj.minutos],
  );

  const paciente = 'sesion' in momento ? patientsById.get(momento.sesion.patientId) : undefined;
  const nombre = paciente?.name ?? 'Paciente borrado';

  const { titulo, grande, pie, tono } = describir(momento, nombre, reloj.hoy);
  // El texto del anuncio depende del tono, no de los minutos: cambia cuatro
  // veces en todo un día en vez de sesenta veces por hora.
  const anuncio = ANUNCIO[tono];

  return (
    /*
     * Sin `aria-live` en el bloque entero. Lo tenía, y como el texto cambia de
     * minuto en minuto, un lector de pantalla anunciaba "en 23 minutos", "en
     * 22 minutos"… una vez por minuto mientras Inicio estuviera abierto: en
     * una sesión de 50 minutos, cincuenta anuncios de algo que no cambió de
     * significado. Lo que vale contar es el cambio de situación —empezó, está
     * por terminar, terminó—, y eso va abajo, en su propia región.
     */
    <section className={`ahora ahora-${tono}`}>
      <div className="ahora-titulo">
        {paciente && (
          <span className="dot" style={{ background: patientColor(paciente.colorIndex).solid }} />
        )}
        {titulo}
      </div>
      <div className="ahora-grande">{grande}</div>
      {pie && <div className="ahora-pie">{pie}</div>}
      {'sesion' in momento && (
        <button className="btn small ahora-link" onClick={onVerAgenda}>
          Ver la agenda
        </button>
      )}

      {/* Solo el cambio de situación, y solo para quien escucha. */}
      <p className="solo-lectores" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}

/** Lo que se anuncia al cambiar la situación. Uno por tono, y nada más. */
const ANUNCIO: Record<Cartel['tono'], string> = {
  calma: '',
  aviso: 'La próxima sesión está por empezar.',
  curso: 'Sesión en curso.',
  fin: 'La sesión está por terminar.',
};

interface Cartel {
  titulo: string;
  grande: string;
  pie: string;
  /** Solo cambia el color de fondo: 'aviso' es cálido, nunca de alarma. */
  tono: 'calma' | 'aviso' | 'curso' | 'fin';
}

/** El texto de cada situación. Separado del componente para poder leerlo junto. */
function describir(momento: Momento, nombre: string, hoy: string): Cartel {
  switch (momento.tipo) {
    case 'en_sesion': {
      const cerrando = momento.faltanMin <= UMBRAL_CIERRE_MIN;
      return {
        titulo: `Estás con ${nombre}`,
        grande: `Faltan ${enPalabras(momento.faltanMin)}`,
        // El aviso de cierre es para la sesión, no para la app: cortar a
        // horario es parte del trabajo y es de lo primero que se escapa.
        pie: cerrando ? 'Buen momento para ir cerrando.' : `Termina a las ${finDe(momento.sesion)}`,
        tono: cerrando ? 'fin' : 'curso',
      };
    }
    case 'hoy': {
      const cerca = momento.faltanMin <= UMBRAL_AVISO_MIN;
      return {
        titulo: cerca ? `Ya viene ${nombre}` : `Después: ${nombre}`,
        grande: `En ${enPalabras(momento.faltanMin)}`,
        pie: `A las ${momento.sesion.time}`,
        tono: cerca ? 'aviso' : 'calma',
      };
    }
    case 'otro_dia':
      return {
        titulo: `Lo próximo: ${nombre}`,
        grande: capitalizar(nombrarDia(momento.sesion.date, hoy)),
        pie: `A las ${momento.sesion.time}`,
        tono: 'calma',
      };
    case 'terminaste':
      return {
        titulo: 'Terminaste por hoy',
        grande: 'A descansar 🌙',
        pie: 'No queda nada agendado.',
        tono: 'fin',
      };
    case 'sin_nada':
      return {
        titulo: 'Hoy no tenés sesiones',
        grande: 'Día libre',
        pie: 'Cuando agendes algo, va a aparecer acá.',
        tono: 'calma',
      };
  }
}

/** A qué hora termina, para no tener que sumarle la duración a la cabeza. */
function finDe(s: Session): string {
  const total = Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3, 5)) + s.durationMin;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
