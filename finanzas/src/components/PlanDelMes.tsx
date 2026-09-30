import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Card, Field } from './ui';
import { planDelMes } from '../lib/finanzas/plan';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { MONTH_NAMES, fromISODate, today } from '../lib/dates';

/**
 * El plan del mes, plegado por defecto: es contexto, no algo para hacer ahora.
 * Un plan no es plata apartada, y lo dice.
 */
export function PlanDelMes() {
  const { data, dispatch } = useStore();
  const hoy = today();
  const p = planDelMes(data, hoy);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(centsToInput(data.preferencias.gastoVariable));
  const mes = MONTH_NAMES[fromISODate(hoy).getMonth()];

  return (
    <Card titulo={`Plan de ${mes}`}>
      <details className="plegable">
        <summary>{p.margen === null ? 'Ver el plan' : p.margen >= 0 ? `Quedan unos ${formatMoney(p.margen)} para metas o colchón` : 'Con lo que sabemos, este mes no cierra'}</summary>
        <table className="cuenta-tabla">
          <tbody>
            <tr>
              <td>Ya cobraste este mes</td>
              <td className="num">+ {formatMoney(p.cobrado)}</td>
            </tr>
            <tr>
              <td>Esperás cobrar</td>
              <td className="num">+ {formatMoney(p.esperado)}</td>
            </tr>
            {p.fijas.map((f, i) => (
              <tr key={i}>
                <td>{f.texto}</td>
                <td className="num">− {formatMoney(f.importe)}</td>
              </tr>
            ))}
            <tr>
              <td>
                Día a día{' '}
                <span className="susurro">
                  ({p.origenDiaADia === 'escrito' ? 'lo que escribiste' : p.origenDiaADia === 'promedio' ? 'promedio de lo anotado' : 'sin datos'})
                </span>
              </td>
              <td className="num">{p.diaADia === null ? '?' : `− ${formatMoney(p.diaADia)}`}</td>
            </tr>
            <tr className="total">
              <td>Margen</td>
              <td className="num" data-testid="margen">
                {p.margen === null ? 'Falta un dato' : formatMoney(p.margen)}
              </td>
            </tr>
          </tbody>
        </table>
        {p.margen !== null && p.margen < 0 && (
          <p className="disponible-deficit-texto">El plan se puede ajustar: mirar qué gasto fijo se puede mover, o qué ingreso falta cargar.</p>
        )}
        {p.faltantes.length > 0 && (
          <ul className="faltantes">
            {p.faltantes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        {editando ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = texto.trim() === '' ? null : parseMoney(texto);
              dispatch({ type: 'prefs/cambiar', cambios: { gastoVariable: v !== null && v > 0 ? v : null } });
              setEditando(false);
            }}
          >
            <Field label="Día a día por mes" ayuda="Comida, transporte, salidas. Vacío = usar el promedio de lo anotado.">
              <input className="input-importe" inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value)} data-autofoco />
            </Field>
            <button type="submit" className="btn chico principal">
              Usar este número
            </button>
          </form>
        ) : (
          <button type="button" className="btn chico" onClick={() => setEditando(true)}>
            Cambiar el día a día
          </button>
        )}
        <p className="susurro">
          Es un plan, no plata apartada: nada se mueve. En pesos; los dólares van aparte. Las compras con tarjeta cuentan en su resumen, no dos
          veces.
        </p>
      </details>
    </Card>
  );
}
