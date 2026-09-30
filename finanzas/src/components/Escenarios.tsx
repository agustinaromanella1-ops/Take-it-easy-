import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { Aviso, Field, Modal } from './ui';
import { formatTasa, parseTasa, simular, SUPUESTOS, type Escenario } from '../lib/finanzas/escenarios';
import { saldo } from '../lib/finanzas/saldos';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';

/**
 * "Si pago tanto por mes, ¿cuándo termino?". Una simulación con los supuestos
 * a la vista. No recomienda nada: muestra cuentas.
 */
export function Escenarios({ cuentaId }: { cuentaId: string }) {
  const { data } = useStore();
  const { cerrar, abrir } = useVentanas();
  const c = data.cuentas.find((x) => x.id === cuentaId);
  const deuda = c ? saldo(c, data.movimientos) : 0;
  const base = c?.cuotaMensual ?? null;
  const [tasa, setTasa] = useState(c?.tasaAnual != null ? String(c.tasaAnual / 100).replace('.', ',') : '');
  const [pagos, setPagos] = useState<string[]>(() => {
    if (base) return [centsToInput(base), centsToInput(Math.round((base * 1.25) / 100) * 100)];
    const b = Math.round(deuda / 12 / 100) * 100;
    return [centsToInput(b), centsToInput(b * 2)];
  });
  if (!c) return null;
  const tasaNum = parseTasa(tasa);

  const fila = (pagoTexto: string, i: number) => {
    const pago = parseMoney(pagoTexto);
    let resultado: Escenario | null = null;
    if (pago !== null && pago > 0 && tasaNum !== null) resultado = simular(deuda, tasaNum, pago);
    return (
      <li key={i} className="escenario">
        <Field label={`Escenario ${i + 1}: pago por mes`}>
          <input
            className="input-importe"
            inputMode="decimal"
            value={pagoTexto}
            onChange={(e) => setPagos((ps) => ps.map((p, j) => (j === i ? e.target.value : p)))}
          />
        </Field>
        {resultado === null ? (
          <p className="susurro">{tasaNum === null ? 'Falta la tasa para calcular.' : 'Escribí un pago mayor a cero.'}</p>
        ) : resultado.termina ? (
          <p>
            Terminás en <strong>{resultado.meses} {resultado.meses === 1 ? 'mes' : 'meses'}</strong>, pagando{' '}
            {formatMoney(resultado.intereses, c.moneda)} de intereses ({formatMoney(resultado.totalPagado, c.moneda)} en total).
          </p>
        ) : (
          <Aviso tono="warn">
            Con ese pago la deuda no baja: el primer mes los intereses son {formatMoney(resultado.interesPrimerMes, c.moneda)}.
          </Aviso>
        )}
      </li>
    );
  };

  return (
    <Modal titulo={`Escenarios: ${c.nombre}`} onClose={cerrar}>
      <p>
        Hoy debés <strong>{formatMoney(deuda, c.moneda)}</strong> según lo anotado.
        {c.cuotaMensual ? ` La cuota es ${formatMoney(c.cuotaMensual, c.moneda)}.` : ''}
      </p>
      <Field label="Tasa nominal anual, %" ayuda={c.tasaAnual != null ? `Cargada en la cuenta: ${formatTasa(c.tasaAnual)}.` : 'No está cargada: probá con la del contrato o el resumen (TNA).'}>
        <input inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="Por ejemplo 85,5" />
      </Field>
      <ul className="lista escenarios">{pagos.map(fila)}</ul>
      <button type="button" className="btn chico" onClick={() => setPagos((p) => [...p, ''])} disabled={pagos.length >= 4}>
        Otro escenario
      </button>
      <h3>Supuestos</h3>
      <ul className="reglas">
        {SUPUESTOS.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p className="susurro">Es una cuenta para comparar, no una recomendación. El número real lo da el banco.</p>
      <div className="acciones acciones-final">
        <button type="button" className="btn" onClick={() => abrir({ tipo: 'cuenta', cuenta: c })}>
          Editar la deuda
        </button>
        <button type="button" className="btn principal" onClick={cerrar}>
          Listo
        </button>
      </div>
    </Modal>
  );
}
