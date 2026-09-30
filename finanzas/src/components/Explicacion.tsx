import type { Moneda } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Modal } from './ui';
import { calcularDisponible, textoFaltante } from '../lib/finanzas/disponible';
import { formatMoney } from '../lib/money';
import { formatDateMedium, today } from '../lib/dates';

/** "¿Cómo se calcula?": la cuenta entera, renglón por renglón, con los importes de verdad. */
export function Explicacion({ moneda }: { moneda: Moneda }) {
  const { data } = useStore();
  const { cerrar } = useVentanas();
  const d = calcularDisponible(data, moneda, today());
  return (
    <Modal titulo="Cómo se calcula" onClose={cerrar}>
      <p>
        Hasta el {formatDateMedium(d.hasta)} ({d.motivoHasta === 'proximo-ingreso' ? 'tu próximo cobro esperado' : 'fin de mes'}).
      </p>
      {d.importe === null ? (
        <p>Todavía no hay con qué calcular: falta al menos una cuenta.</p>
      ) : (
        <table className="cuenta-tabla">
          <tbody>
            {d.renglones.map((r, i) => (
              <tr key={i}>
                <td>{r.texto}</td>
                <td className="num">
                  {r.signo === '−' ? '−' : '+'} {formatMoney(Math.abs(r.importe), moneda)}
                  {r.signo === '+' && r.importe < 0 ? ' (en negativo)' : ''}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td>Podés usar</td>
              <td className="num">{formatMoney(d.importe, moneda)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <ul className="reglas">
        <li>Los ingresos que todavía no cobraste no se suman.</li>
        <li>Las cuotas de la tarjeta se restan solo en el resumen en que vencen.</li>
        <li>Lo que apartaste para una meta no está disponible, pero sigue siendo tuyo.</li>
        <li>Pesos y dólares se calculan por separado. Nunca se suman.</li>
      </ul>
      {d.faltantes.length > 0 && (
        <>
          <h3>Lo que falta saber</h3>
          <ul>
            {d.faltantes.map((f, i) => (
              <li key={i}>{textoFaltante(f)}</li>
            ))}
          </ul>
        </>
      )}
      <div className="acciones acciones-final">
        <button className="btn principal" onClick={cerrar}>
          Entendido
        </button>
      </div>
    </Modal>
  );
}
