// `defineConfig` sale de `vitest/config` y no de `vite`: es el mismo, con el
// bloque `test` en el tipo. Con el de `vite` el typecheck rechaza la clave.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Una sola configuración para el servidor de desarrollo, el build y los tests:
// Vitest lee este mismo archivo, así que lo que resuelve Vite en el browser lo
// resuelve igual la suite. Es el mismo criterio que en `api/`, donde `vite-node`
// y Vitest comparten resolución (decisión 46).
export default defineConfig({
  plugins: [react()],
  server: {
    // El celular del corral entra por la red local, no por localhost.
    host: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/preparacion.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
