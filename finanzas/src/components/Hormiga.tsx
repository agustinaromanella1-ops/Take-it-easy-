import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { useVentanas } from './Ventanas';
import { DibujoHormiga } from './Salchicha';
import { debeAparecer, guardarHormiga, leerHormiga, SEGUNDOS_VISIBLE } from '../lib/hormiga';
import { today } from '../lib/dates';

/**
 * La hormiguita: aparece de vez en cuando en una esquina de Hoy, sin tapar
 * nada, y pregunta por algún gasto chiquito sin anotar. Si se la ignora, se
 * va. Las reglas de frecuencia están en `src/lib/hormiga.ts`.
 */
export function Hormiga({ enHoy, ocupada }: { enHoy: boolean; ocupada: boolean }) {
  const { data } = useStore();
  const { abrir } = useVentanas();
  const [visible, setVisible] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const p = data.preferencias;

  useEffect(() => {
    const hoy = today();
    const estado = leerHormiga();
    const ok = debeAparecer(
      estado,
      { activada: p.hormiga, enHoy, ocupada, bajaEnergia: p.bajaEnergia, hayCuentas: data.cuentas.length > 0 },
      hoy,
    );
    if (!ok || visible) return;
    // Aparece un rato después de llegar a Hoy, no de golpe.
    const t = setTimeout(() => {
      guardarHormiga({ ...estado, ultimaAparicion: hoy });
      setVisible(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [p.hormiga, p.bajaEnergia, enHoy, ocupada, data.cuentas.length, visible]);

  // Si se la ignora, se va sola. Ignorarla no cambia nada más.
  useEffect(() => {
    if (!visible || abierta) return;
    const t = setTimeout(() => setVisible(false), SEGUNDOS_VISIBLE * 1000);
    return () => clearTimeout(t);
  }, [visible, abierta]);

  useEffect(() => {
    if (!enHoy || ocupada) setVisible(false);
  }, [enHoy, ocupada]);

  if (!visible) return null;

  const cerrarla = (descartada: boolean) => {
    if (descartada) guardarHormiga({ ...leerHormiga(), descartadaEl: today() });
    setVisible(false);
    setAbierta(false);
  };

  return (
    <div className="hormiga" role="complementary" aria-label="Recordatorio de la hormiguita">
      {abierta ? (
        <div className="hormiga-globo">
          <p>¿Quedó algún gasto chiquito sin anotar?</p>
          <div className="acciones">
            <button
              type="button"
              className="btn chico principal"
              onClick={() => {
                cerrarla(false);
                abrir({ tipo: 'anotar' });
              }}
            >
              Anotar uno
            </button>
            <button type="button" className="btn chico" onClick={() => cerrarla(false)}>
              Ya revisé
            </button>
            <button type="button" className="btn chico" onClick={() => cerrarla(true)}>
              Ahora no
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="hormiga-boton" onClick={() => setAbierta(true)} aria-label="Hormiguita: ¿quedó algún gasto chiquito sin anotar?">
          <DibujoHormiga />
        </button>
      )}
    </div>
  );
}
