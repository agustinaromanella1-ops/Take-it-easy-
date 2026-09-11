import { olvidarInstructivo } from '../datos/preferencias';
import './Ajustes.css';

export default function Ajustes({ verInstructivo }: { verInstructivo: () => void }) {
  async function volverAVer() {
    await olvidarInstructivo();
    verInstructivo();
  }

  return (
    <div className="pantalla ajustes">
      <header>
        <h1>Ajustes</h1>
      </header>

      <section>
        <h2>Instructivo</h2>
        <p className="detalle">
          Volvé a ver la bienvenida y las pistas de cada pantalla, como la
          primera vez.
        </p>
        <button className="secundario" onClick={volverAVer}>
          Ver el instructivo de nuevo
        </button>
      </section>

      <section>
        <h2>Tus datos</h2>
        <p className="detalle">
          Todo lo que cargás vive en este teléfono. No se sube a ningún servidor
          y no se comparte con nadie.
        </p>
        <p className="pendiente">
          Exportar una copia de seguridad todavía no está hecho. Es lo próximo.
        </p>
      </section>
    </div>
  );
}
