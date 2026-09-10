import { enPalabras, hoy } from './fecha';
import { esNativa, plataforma } from './nativo/plataforma';
import './App.css';

export default function App() {
  const fecha = hoy();

  return (
    <main className="pantalla">
      <header>
        <p className="fecha">{enPalabras(fecha)}</p>
        <h1>Hoy</h1>
      </header>

      <section className="vacio">
        <p className="invitacion">Todavía no cargaste tus materias.</p>
        <p className="detalle">
          Cuando estén, acá vas a ver las clases del día en orden, y vas a poder
          tomar asistencia de la que sigue.
        </p>
      </section>

      <footer>
        {esNativa() ? `Corriendo en ${plataforma()}` : 'Corriendo en el navegador'}
        {' · '}
        {fecha}
      </footer>
    </main>
  );
}
