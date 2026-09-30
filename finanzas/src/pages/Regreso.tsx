import { useEffect, useState } from 'react';
import type { DateISO } from '../types';
import { useStore } from '../store/StoreContext';
import { useVentanas } from '../components/Ventanas';
import { Aviso, Field } from '../components/ui';
import { Salchicha } from '../components/Salchicha';
import { saldo, esTarjeta } from '../lib/finanzas/saldos';
import { formatMoney, parseMoney } from '../lib/money';
import { addDays, daysBetween, formatDateMedium, today } from '../lib/dates';
import { newId } from '../lib/id';
import { mensaje } from '../lib/companero';

/**
 * Volver después de una pausa. Es un flujo central, no un extra.
 *
 * Sin reproches y sin reconstruir el pasado: se pone al día cómo está todo
 * HOY. Si un saldo no coincide, la diferencia queda registrada como tal, sin
 * inventar categorías ni movimientos. Se puede salir en cualquier paso y lo
 * hecho queda hecho.
 *
 * El orden importa: primero los compromisos que vencieron, después los
 * saldos. Si se confirmara el saldo antes, marcar un pago después lo restaría
 * dos veces.
 */
type Paso = 'inicio' | 'pasado' | 'compromisos' | 'sin-cuenta' | 'saldos' | 'listo';

export function Regreso({ desde, onSalir }: { desde: DateISO; onSalir: () => void }) {
  const { data, dispatch, huellita } = useStore();
  const { abrir } = useVentanas();
  const hoy = today();
  const p = data.preferencias;
  const [paso, setPaso] = useState<Paso>('inicio');
  const [indice, setIndice] = useState(0);
  const [importe, setImporte] = useState('');
  const [error, setError] = useState('');
  // La lista de cada paso se fija al entrar: si se recalculara, pagar uno
  // correría los índices y se saltearía el siguiente.
  const [ids, setIds] = useState<string[]>([]);
  const conPerro = p.companero !== 'no';

  const vencidos = data.compromisos.filter((k) => !k.pagado && k.vencimiento < hoy);
  const sinCuenta = data.movimientos.filter((m) => m.tipo === 'gasto' && m.cuentaId === null);
  const cuentas = data.cuentas.filter((c) => !c.archivada && !esTarjeta(c));

  const siguiente = (desdePaso: Paso) => {
    setIndice(0);
    setImporte('');
    setError('');
    const orden: Paso[] = ['compromisos', 'sin-cuenta', 'saldos', 'listo'];
    const vacio = (x: Paso) => (x === 'compromisos' && vencidos.length === 0) || (x === 'sin-cuenta' && sinCuenta.length === 0) || (x === 'saldos' && cuentas.length === 0);
    const inicio = desdePaso === 'inicio' || desdePaso === 'pasado' ? 0 : orden.indexOf(desdePaso) + 1;
    const prox = orden.slice(inicio).find((x) => !vacio(x)) ?? 'listo';
    if (prox === 'compromisos') setIds(vencidos.map((k) => k.id));
    if (prox === 'saldos') setIds(cuentas.map((c) => c.id));
    setPaso(prox);
  };

  useEffect(() => {
    if (paso === 'listo') huellita('retomar');
  }, [paso, huellita]);

  // Asignar un gasto lo saca de la lista; cuando no queda ninguno, se sigue.
  useEffect(() => {
    if (paso === 'sin-cuenta' && sinCuenta.length === 0) siguiente('sin-cuenta');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, sinCuenta.length]);

  const salir = (
    <button className="btn-texto" onClick={onSalir}>
      Salir y seguir otro día
    </button>
  );

  if (paso === 'inicio') {
    const dias = daysBetween(desde, hoy);
    return (
      <main className="regreso">
        {conPerro && <Salchicha tam={200} etiqueta="Salchi te saluda" />}
        <h1>Hola de nuevo.</h1>
        <p className="bienvenida-lema">{mensaje('regreso', p.trato)}</p>
        <p>
          Pasaron {dias} días. No hace falta reconstruir nada: ponemos al día cómo está todo hoy, y lo de antes queda como está.
        </p>
        <div className="acciones columna">
          <button className="btn principal grande" onClick={() => siguiente('inicio')} autoFocus>
            Poner al día cómo estoy hoy
          </button>
          <button className="btn grande" onClick={() => setPaso('pasado')}>
            Revisar también lo que pasó
          </button>
          <button className="btn-texto" onClick={onSalir}>
            Ahora no, ir a Hoy
          </button>
        </div>
      </main>
    );
  }

  if (paso === 'pasado') {
    return (
      <main className="regreso">
        <p className="paso-numero">Lo que pasó</p>
        <h1>¿Te acordás de algo grande de estos días?</h1>
        <p>Solo lo que te acuerdes sin esfuerzo. Lo que no, lo cubre la actualización de saldos del final, sin que tengas que adivinar.</p>
        <button className="btn grande" onClick={() => abrir({ tipo: 'anotar', fecha: addDays(desde, 1) })}>
          Anotar algo de esos días
        </button>
        <div className="acciones columna">
          <button className="btn principal grande" onClick={() => siguiente('pasado')}>
            Listo, seguir
          </button>
          {salir}
        </div>
      </main>
    );
  }

  if (paso === 'compromisos') {
    const k = data.compromisos.find((x) => x.id === ids[indice]);
    const avanzar = () => {
      if (indice + 1 >= ids.length) siguiente('compromisos');
      else setIndice(indice + 1);
    };
    if (!k) return null;
    return (
      <main className="regreso">
        <p className="paso-numero">
          Lo que venció ({indice + 1} de {ids.length})
        </p>
        <h1>¿Pagaste {k.nombre}?</h1>
        <p>
          Vencía el {formatDateMedium(k.vencimiento)}
          {k.importe !== null ? ` y era ${formatMoney(k.importe, k.moneda)}` : ''}.
        </p>
        <div className="acciones columna">
          <button
            className="btn principal grande"
            onClick={() => {
              // Sin movimiento: el saldo se actualiza en el paso siguiente y
              // ahí queda reflejado. Anotarlo también lo restaría dos veces.
              dispatch({ type: 'compromiso/pagar', id: k.id, pago: null, siguienteId: newId() });
              avanzar();
            }}
          >
            Sí, ya lo pagué
          </button>
          <button className="btn grande" onClick={avanzar}>
            Todavía no
          </button>
          <button className="btn grande" onClick={avanzar}>
            No me acuerdo
          </button>
          {salir}
        </div>
        <p className="susurro">Lo que quede sin pagar sigue en Hoy, uno por vez.</p>
      </main>
    );
  }

  if (paso === 'sin-cuenta') {
    const m = sinCuenta[0];
    if (!m) return null;
    return (
      <main className="regreso">
        <p className="paso-numero">Gastos sin cuenta ({sinCuenta.length})</p>
        <h1>¿De dónde salió este?</h1>
        <p>
          {m.comercio || 'Un gasto'} de <strong>{formatMoney(m.importe, m.moneda)}</strong>, el {formatDateMedium(m.fecha)}.
        </p>
        <div className="acciones columna">
          {cuentas
            .filter((c) => c.moneda === m.moneda)
            .map((c) => (
              <button
                key={c.id}
                className="btn grande"
                onClick={() => {
                  const { updatedAt: _u, ...resto } = m;
                  dispatch({ type: 'mov/editar', mov: { ...resto, cuentaId: c.id } });
                }}
              >
                {c.nombre}
              </button>
            ))}
          <button className="btn-texto" onClick={() => siguiente('sin-cuenta')}>
            Dejarlos así por ahora
          </button>
        </div>
      </main>
    );
  }

  if (paso === 'saldos') {
    const c = data.cuentas.find((x) => x.id === ids[indice]);
    if (!c) return null;
    const calculado = saldo(c, data.movimientos);
    const avanzar = () => {
      setImporte('');
      setError('');
      if (indice + 1 >= ids.length) siguiente('saldos');
      else setIndice(indice + 1);
    };
    const real = parseMoney(importe);
    return (
      <main className="regreso">
        <p className="paso-numero">
          Saldos ({indice + 1} de {ids.length})
        </p>
        <h1>¿Cuánto hay hoy en {c.nombre}?</h1>
        <p>Según lo anotado, {formatMoney(calculado, c.moneda)}. Con mirar el número en el banco o la billetera alcanza.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (real === null) return setError('Escribí el número que ves.');
            dispatch({ type: 'cuenta/confirmarSaldo', cuentaId: c.id, saldoReal: real, fecha: hoy, ajusteId: newId() });
            avanzar();
          }}
        >
          <Field label="Saldo de hoy" error={error || undefined}>
            <input className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" autoFocus />
          </Field>
          {real !== null && real !== calculado && (
            <Aviso>
              La diferencia ({formatMoney(real - calculado, c.moneda)}) queda registrada como diferencia sin conciliar. No hace falta saber de dónde
              salió.
            </Aviso>
          )}
          <div className="acciones columna">
            <button type="submit" className="btn principal grande" disabled={importe.trim() === ''}>
              Guardar
            </button>
            <button
              type="button"
              className="btn grande"
              onClick={() => {
                dispatch({ type: 'cuenta/confirmarSaldo', cuentaId: c.id, saldoReal: calculado, fecha: hoy, ajusteId: newId() });
                avanzar();
              }}
            >
              Está bien así
            </button>
            <button type="button" className="btn-texto" onClick={avanzar}>
              Saltear esta
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="regreso">
      {conPerro && <Salchicha tam={200} etiqueta="Salchi, contento" />}
      <h1>{mensaje('listo', p.trato)}</h1>
      <p>Tu historial quedó como estaba, y lo de hoy está al día.</p>
      <button className="btn principal grande" onClick={onSalir} autoFocus>
        Ir a Hoy
      </button>
    </main>
  );
}
