import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import App from './App';
import { aplicarTema, leerTema, seguirAlSistema } from './lib/tema';
import { aplicarAnimaciones, leerAnimaciones } from './lib/movimiento';
import { setupPWA } from './pwa';

// Atkinson Hyperlegible: diseñada para que cada letra se distinga de las
// demás. Va empaquetada con la app; no se pide a ningún servidor de fuentes.
aplicarTema(leerTema());
seguirAlSistema(leerTema);
aplicarAnimaciones(leerAnimaciones());
setupPWA();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
