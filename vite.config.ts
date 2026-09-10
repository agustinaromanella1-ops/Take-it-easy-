/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    // La app se usa en Argentina y las fechas son locales. Corriendo los tests
    // en UTC, los que prueban el corte del día pasan sin probar nada.
    env: { TZ: 'America/Argentina/Buenos_Aires' },
  },
})
