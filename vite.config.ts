/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import paquete from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],
  // La versión se escribe en un solo lugar, package.json, y llega a la
  // pantalla desde acá. Que la app diga una versión y el repositorio otra
  // vuelve inútil cualquier "¿qué versión tenés?".
  define: { __VERSION__: JSON.stringify(paquete.version) },
  test: {
    // La app se usa en Argentina y las fechas son locales. Corriendo los tests
    // en UTC, los que prueban el corte del día pasan sin probar nada.
    env: { TZ: 'America/Argentina/Buenos_Aires' },
  },
})
