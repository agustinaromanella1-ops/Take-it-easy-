import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { aspectoRecordado, pintar } from './aspecto'

// El tema elegido se pinta antes del primer cuadro, desde la cache: si se
// esperara a IndexedDB, cada arranque en oscuro empezaría en claro.
const recordado = aspectoRecordado()
pintar(recordado.tema, recordado.animaciones)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
