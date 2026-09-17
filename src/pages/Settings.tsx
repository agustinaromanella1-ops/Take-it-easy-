import { useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { parseAppData } from '../lib/storage';
import { today } from '../lib/dates';
import { downloadText } from '../lib/download';
import { cobrosCSV, sesionesCSV } from '../lib/csv';
import { guardarTema, leerTema, type Tema } from '../lib/tema';
import { guardarAnimaciones, leerAnimaciones, type Animaciones } from '../lib/movimiento';
import { Card, Field } from '../components/ui';

/**
 * Los datos viven solo en este navegador. Sin exportar/importar, limpiar la
 * caché o cambiar de computadora significa perder todo el historial; por eso la
 * copia de seguridad es parte de la app, no un extra.
 */
export function SettingsPage() {
  const { data, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Seguir al sistema mientras esté en "automático" lo hace App, que no se
  // desmonta: acá solo se elige.
  const [tema, setTema] = useState<Tema>(leerTema);

  function cambiarTema(nuevo: Tema) {
    setTema(nuevo);
    guardarTema(nuevo);
  }

  const [animaciones, setAnimaciones] = useState<Animaciones>(leerAnimaciones);

  function cambiarAnimaciones(nuevo: Animaciones) {
    setAnimaciones(nuevo);
    guardarAnimaciones(nuevo);
  }

  /** Planillas para abrir en Excel. No reemplazan la copia de seguridad: la
      copia sirve para volver atrás, la planilla para mirar y compartir. */
  function exportarPlanilla(que: 'sesiones' | 'cobros') {
    const hoy = today();
    downloadText(
      `pipi-cucu-${que}-${hoy}.csv`,
      que === 'sesiones' ? sesionesCSV(data) : cobrosCSV(data),
      'text/csv;charset=utf-8',
    );
  }

  function exportData() {
    const total = data.patients.length + data.sessions.length + data.payments.length;

    // Una copia vacía es peor que ninguna: uno la guarda, se queda tranquilo, y
    // se entera de que no tenía nada el día que la necesita. Si no hay qué
    // guardar, se dice y no se descarga.
    if (total === 0) {
      setMessage({
        text: 'Todavía no hay nada para exportar: la copia saldría vacía. Cargá al menos un paciente.',
        ok: false,
      });
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipi-cucu-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // Decir qué se llevó: así se puede comprobar de un vistazo que la copia
    // tiene lo que tenía que tener, sin abrir el archivo.
    setMessage({
      text: `Copia guardada: ${data.patients.length} paciente(s), ${data.sessions.length} sesión(es) y ${data.payments.length} pago(s).`,
      ok: true,
    });
  }

  async function importData(file: File) {
    try {
      const parsed = parseAppData(JSON.parse(await file.text()));
      const ok = window.confirm(
        `El archivo tiene ${parsed.patients.length} paciente(s), ${parsed.sessions.length} sesión(es) y ` +
          `${parsed.payments.length} pago(s).\n\nEsto REEMPLAZA todos los datos actuales. ¿Continuar?`,
      );
      if (!ok) return;
      dispatch({ type: 'data/replace', payload: parsed });
      setMessage({ text: 'Datos importados correctamente.', ok: true });
    } catch {
      setMessage({ text: 'No se pudo leer el archivo. ¿Es una copia de Pipí Cucú?', ok: false });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Ajustes</h1>
      </div>

      <Card title="Preferencias">
        <div className="field-row">
          <Field label="Símbolo de moneda">
            <input
              value={data.settings.currency}
              maxLength={4}
              onChange={(e) => dispatch({ type: 'settings/update', payload: { currency: e.target.value } })}
            />
          </Field>
          <Field label="Duración por defecto (min)">
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={data.settings.defaultDurationMin}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 5 && n <= 480) {
                  dispatch({ type: 'settings/update', payload: { defaultDurationMin: Math.round(n) } });
                }
              }}
            />
          </Field>
        </div>
        <div className="field-row">
          <Field label="Alarma del recordatorio (min antes)">
            <input
              type="number"
              min={0}
              max={1440}
              step={5}
              value={data.settings.reminderMinutes}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0 && n <= 1440) {
                  dispatch({ type: 'settings/update', payload: { reminderMinutes: Math.round(n) } });
                }
              }}
            />
          </Field>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={data.settings.chargeNoShowByDefault}
            onChange={(e) =>
              dispatch({ type: 'settings/update', payload: { chargeNoShowByDefault: e.target.checked } })
            }
            style={{ width: 'auto' }}
          />
          Cobrar las ausencias sin aviso por defecto
        </label>
      </Card>

      <Card title="Copia de seguridad">
        <p className="small muted" style={{ marginTop: 0 }}>
          Tus datos se guardan únicamente en este navegador. Si limpiás la caché, cambiás de computadora o usás el
          modo incógnito, se pierden. Exportá una copia cada tanto y guardala en Drive o en un pendrive.
        </p>
        <p className="small muted">
          La copia es un archivo <code>.json</code>: no se abre en Excel, pero es el único que la app puede volver
          a importar para dejarte todo como estaba. Para mirar los números hay planillas más abajo.
        </p>
        <div className="actions">
          <button className="btn primary" onClick={exportData}>
            Exportar copia (.json)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importar copia
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importData(file);
            }}
          />
        </div>
        {message && (
          <p className={`small ${message.ok ? '' : 'error-text'}`} style={{ marginBottom: 0 }}>
            {message.text}
          </p>
        )}
      </Card>

      <Card title="Datos guardados">
        <p className="small muted" style={{ margin: 0 }}>
          {data.patients.length} paciente(s) · {data.sessions.length} sesión(es) · {data.payments.length} pago(s)
        </p>
      </Card>

      <Card title="Cómo se ve">
        <p className="small" style={{ marginTop: 0 }}>
          Automático sigue lo que tengas puesto en el teléfono.
        </p>
        <div className="seg" role="group" aria-label="Tema de la app">
          {([
            ['auto', 'Automático'],
            ['claro', '☀ Claro'],
            ['oscuro', '🌙 Oscuro'],
          ] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              className={tema === valor ? 'is-on' : ''}
              aria-pressed={tema === valor}
              onClick={() => cambiarTema(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        <p className="small" style={{ marginBottom: 6, marginTop: 20 }}>Animaciones</p>
        <div className="seg" role="group" aria-label="Animaciones">
          {([
            ['auto', 'Según el sistema'],
            ['siempre', 'Siempre'],
            ['nunca', 'Nunca'],
          ] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              className={animaciones === valor ? 'is-on' : ''}
              aria-pressed={animaciones === valor}
              onClick={() => cambiarAnimaciones(valor)}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Si el perrito de la portada está quieto es porque tu equipo tiene las animaciones
          apagadas —el ahorro de batería suele hacerlo solo—. Con “Siempre” vuela igual.
        </p>
      </Card>

      <Card title="Planillas para Excel">
        <p className="small" style={{ marginTop: 0 }}>
          Para hacer tus números, pasarle algo a tu contador o guardar el año cerrado. Se abren en Excel, en Google
          Sheets y en cualquier planilla.
        </p>
        <div className="actions">
          <button className="btn" onClick={() => exportarPlanilla('sesiones')}>
            Sesiones (.csv)
          </button>
          <button className="btn" onClick={() => exportarPlanilla('cobros')}>
            Cobros (.csv)
          </button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Ojo: una planilla no sirve para restaurar la app. Para eso está la copia <code>.json</code> de arriba.
        </p>
      </Card>

      {/* La pregunta "¿y en la computadora?" aparece sola. Conviene responderla
          antes de que aparezca, y explicando el motivo: sin el porqué, esto se
          lee como una función que falta en lugar de una decisión. */}
      <Card title="Por qué no se sincroniza">
        <p className="small" style={{ marginTop: 0 }}>
          Pipí Cucú funciona en un dispositivo por vez, a propósito. Sincronizar obligaría a mandar
          tus pacientes a un servidor y a protegerlos con una contraseña que, si se pierde, nadie
          podría devolverte: si alguien pudiera recuperarla, también podría leerlos.
        </p>
        <p className="small" style={{ marginBottom: 0 }}>
          Entre esas dos cosas, la app elige que tu información no salga de acá y que no dependa de
          que te acuerdes de nada. A cambio, para pasar a otro dispositivo hay que exportar e
          importar —y tené en cuenta que importar reemplaza lo que haya cargado—.
        </p>
      </Card>

      <Card title="Privacidad">
        <p className="small" style={{ marginTop: 0 }}>
          Tus datos no salen de este dispositivo. No hay servidores, ni cuentas, ni terceros.
        </p>
        {/* Página aparte y no una pantalla de la app: Google Play pide una
            dirección pública que se pueda abrir sin instalar nada. */}
        <a className="btn small" href="/privacidad.html" target="_blank" rel="noopener noreferrer">
          Leer la política de privacidad
        </a>
      </Card>

    </>
  );
}
