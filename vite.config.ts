// `defineConfig` sale de `vitest/config` y no de `vite`: es el mismo, con el
// bloque `test` en el tipo. Con el de `vite` el typecheck rechaza la clave.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Una sola configuración para el servidor de desarrollo, el build y los tests:
 * Vitest lee este mismo archivo, así que lo que resuelve Vite en el browser lo
 * resuelve igual la suite. Es el mismo criterio que en `api/`, donde `vite-node`
 * y Vitest comparten resolución (decisión 46).
 *
 * El **proxy** es lo que hace que la UI pueda hablar con la demo desde un
 * browser de verdad. La API no manda cabeceras CORS —no tiene por qué: hasta la
 * Fase 6 no sabe quién le habla— y un `fetch` de `localhost:5173` a
 * `127.0.0.1:3000` es cross-origin, así que el browser lo bloquea antes de que
 * salga. Con el proxy los pedidos salen al mismo origen y Vite los reenvía: la
 * UI no necesita saberlo y la API no necesita cambiar (decisión 55).
 */
// `process` declarado a mano en vez de traer `@types/node`: es lo único de Node
// que este paquete toca, y meter los tipos globales dejaría que el código que va
// al browser use `process` o `Buffer` sin que el typecheck chiste.
declare const process: { env: Record<string, string | undefined> };

const apiDeDesarrollo = process.env['DEMO_URL'] ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    // El celular del corral entra por la red local, no por localhost.
    host: true,
    proxy: {
      '/establecimientos': { target: apiDeDesarrollo, changeOrigin: true },
      '/salud': { target: apiDeDesarrollo, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/preparacion.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
