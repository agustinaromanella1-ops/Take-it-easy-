import { useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { parseAppData } from '../lib/storage';
import { today } from '../lib/dates';
import { downloadText } from '../lib/download';
import { cobrosCSV, sesionesCSV } from '../lib/csv';
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
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipi-cucu-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
