import { useState } from 'react';
import type { Companero, Moneda, TipoCuenta } from '../types';
import { useStore } from '../store/StoreContext';
import { Field, Llave, Opciones } from '../components/ui';
import { Salchicha } from '../components/Salchicha';
import { parseMoney } from '../lib/money';
import { addDays, today } from '../lib/dates';
import { newId } from '../lib/id';

/**
 * Primer uso: tres pasos como máximo, todos salteables. La app arranca vacía
 * de verdad; con una cuenta ya da un número útil.
 */
export function Bienvenida({ onVerEjemplo }: { onVerEjemplo: () => void }) {
  const { dispatch } = useStore();
  const [paso, setPaso] = useState(0);
  const [tipo, setTipo] = useState<TipoCuenta>('banco');
  const [nombre, setNombre] = useState('');
  const [moneda] = useState<Moneda>('ARS');
  const [importe, setImporte] = useState('');
  const [aprox, setAprox] = useState(false);
  const [compNombre, setCompNombre] = useState('');
  const [compImporte, setCompImporte] = useState('');
  const [compVence, setCompVence] = useState(addDays(today(), 7));
  const [error, setError] = useState('');

  const terminar = (companero: Companero) => {
    dispatch({ type: 'prefs/cambiar', cambios: { onboardingHecho: true, companero } });
  };

  if (paso === 0) {
    return (
      <main className="bienvenida">
        <Salchicha tam={220} etiqueta="Salchi, un perro salchicha, te saluda" />
        <h1>Hola. Soy Salchi.</h1>
        <p className="bienvenida-lema">Tu plata, de a poquito.</p>
        <p>Anotás gastos en dos toques, ves cuánto podés usar y qué vence. Todo queda en tu teléfono.</p>
        <button className="btn principal grande" onClick={() => setPaso(1)} autoFocus>
          Empezar
        </button>
        <button className="btn-texto" onClick={onVerEjemplo}>
          Mirar primero con datos de ejemplo
        </button>
      </main>
    );
  }

  if (paso === 1) {
    return (
      <main className="bienvenida paso">
        <p className="paso-numero">Paso 1 de 3</p>
        <h1>¿Cuánta plata tenés hoy y dónde?</h1>
        <p>Con una cuenta alcanza. Después podés sumar más.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const saldo = parseMoney(importe);
            if (saldo === null) return setError('Escribí un número, aunque sea aproximado.');
            const hoy = today();
            dispatch({
              type: 'cuenta/agregar',
              cuenta: {
                id: newId(),
                nombre: nombre.trim() || (tipo === 'efectivo' ? 'Efectivo' : tipo === 'billetera' ? 'Mercado Pago' : 'Banco'),
                tipo,
                moneda,
                saldoInicial: saldo,
                fechaSaldo: hoy,
                aproximado: aprox,
                cuentaParaDisponible: true,
                confirmadoEn: hoy,
                alias: tipo === 'banco' ? ['débito'] : tipo === 'billetera' ? ['mp'] : [],
                diaCierre: null,
                diaVencimiento: null,
                archivada: false,
              },
            });
            setPaso(2);
          }}
        >
          <Opciones
            legend="Dónde"
            valor={tipo}
            opciones={[
              { valor: 'banco', texto: 'Banco' },
              { valor: 'billetera', texto: 'Billetera virtual' },
              { valor: 'efectivo', texto: 'Efectivo' },
            ]}
            onChange={setTipo}
          />
          <Field label="Nombre (opcional)">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === 'billetera' ? 'Mercado Pago' : tipo === 'efectivo' ? 'Efectivo' : 'Banco'} />
          </Field>
          <Field label="¿Cuánto hay hoy?" error={error || undefined}>
            <input className="input-importe" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} placeholder="0" autoFocus />
          </Field>
          <Llave label="No sé exacto, es aproximado" ayuda="Vale igual. Queda marcado y se puede corregir después." checked={aprox} onChange={setAprox} />
          <button type="submit" className="btn principal grande">
            Seguir
          </button>
        </form>
        <button className="btn-texto" onClick={() => setPaso(2)}>
          Saltear
        </button>
      </main>
    );
  }

  if (paso === 2) {
    return (
      <main className="bienvenida paso">
        <p className="paso-numero">Paso 2 de 3</p>
        <h1>¿Hay algo que tengas que pagar pronto?</h1>
        <p>Uno alcanza: alquiler, luz, la tarjeta. Si no sabés el importe, dejalo vacío.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!compNombre.trim()) return setPaso(3);
            const monto = compImporte.trim() === '' ? null : parseMoney(compImporte);
            dispatch({
              type: 'compromiso/agregar',
              compromiso: { id: newId(), nombre: compNombre.trim(), importe: monto, moneda: 'ARS', vencimiento: compVence || today(), recurrencia: 'mensual', pagado: false, pagoId: null },
            });
            setPaso(3);
          }}
        >
          <Field label="Qué es">
            <input value={compNombre} onChange={(e) => setCompNombre(e.target.value)} placeholder="Alquiler" autoFocus />
          </Field>
          <Field label="Cuándo vence">
            <input type="date" value={compVence} onChange={(e) => setCompVence(e.target.value)} />
          </Field>
          <Field label="Importe (opcional)">
            <input className="input-importe" inputMode="decimal" value={compImporte} onChange={(e) => setCompImporte(e.target.value)} placeholder="0" />
          </Field>
          <button type="submit" className="btn principal grande">
            Seguir
          </button>
        </form>
        <button className="btn-texto" onClick={() => setPaso(3)}>
          Saltear
        </button>
      </main>
    );
  }

  return (
    <main className="bienvenida paso">
      <p className="paso-numero">Paso 3 de 3</p>
      <Salchicha tam={200} etiqueta="Salchi" />
      <h1>¿Querés que te acompañe?</h1>
      <p>Puedo quedarme en la pantalla, aparecer de vez en cuando o no aparecer. Sin mí, la app hace exactamente lo mismo.</p>
      <div className="acciones columna">
        <button className="btn principal grande" onClick={() => terminar('visible')} autoFocus>
          Sí, quedate
        </button>
        <button className="btn grande" onClick={() => terminar('ocasional')}>
          De vez en cuando
        </button>
        <button className="btn grande" onClick={() => terminar('no')}>
          Sin personaje
        </button>
      </div>
    </main>
  );
}
