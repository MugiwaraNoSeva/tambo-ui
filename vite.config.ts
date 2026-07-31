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
 * browser de verdad. La API no manda cabeceras CORS y un `fetch` de
 * `localhost:5173` a `127.0.0.1:3000` es cross-origin, así que el browser lo
 * bloquea antes de que salga. Con el proxy los pedidos salen al mismo origen y
 * Vite los reenvía: la UI no necesita saberlo y la API no necesita cambiar
 * (decisión 55). Cada prefijo de la API que la UI use tiene que estar en esta
 * lista — y la lista se olvida justo cuando aparece uno nuevo.
 */
// `process` declarado a mano en vez de traer `@types/node`: es lo único de Node
// que este paquete toca, y meter los tipos globales dejaría que el código que va
// al browser use `process` o `Buffer` sin que el typecheck chiste.
declare const process: { env: Record<string, string | undefined> };

const apiDeDesarrollo = process.env['DEMO_URL'] ?? 'http://127.0.0.1:3000';

// ── El build de Render no sale sin saber dónde está la API ──────────────────
//
// `VITE_API_URL` **se incrusta en el bundle al compilar**, no se lee en runtime.
// Si falta, `urlBase()` cae a "mismo origen" — que es correcto cuando la API
// sirve la UI, y acá no la sirve: la UI es un sitio estático y la API vive en
// otro host. El resultado sería una app que carga perfecto, muestra el login y
// falla todos los pedidos contra el CDN, con un "Failed to fetch" que no dice
// una palabra de la causa. Falla en silencio y se diagnostica mal.
//
// En Render eso no puede ser otra cosa que un error de configuración, así que el
// build se cae acá: es ruidoso y se arregla en un minuto. Fuera de Render el
// mismo origen sigue siendo legítimo y esto no se entromete.
if (process.env['RENDER'] === 'true' && (process.env['VITE_API_URL'] ?? '').trim() === '') {
  throw new Error(
    'Falta VITE_API_URL y esto es un build de Render: la UI quedaría pidiéndole los datos al ' +
      'sitio estático en vez de a la API. Poné la URL del servicio de la API (sin barra final) ' +
      'en las variables de entorno del sitio y volvé a desplegar. Se incrusta al compilar, así ' +
      'que cambiarla obliga a rebuildear.',
  );
}

export default defineConfig({
  plugins: [react()],
  server: {
    // El celular del corral entra por la red local, no por localhost.
    host: true,
    proxy: {
      // `/auth` es el que hace falta desde la cerradura, y olvidarlo cuesta caro:
      // el login falla por CORS y el síntoma —"Failed to fetch"— no dice una
      // palabra de la causa. Es la primera media hora que pierde el que venga.
      '/auth': { target: apiDeDesarrollo, changeOrigin: true },
      '/establecimientos': { target: apiDeDesarrollo, changeOrigin: true },
      // La UI no pega acá —administrar usuarios se hace con `curl`—, pero está
      // reenviado para que probar la API desde el mismo origen no obligue a
      // tocar este archivo.
      '/usuarios': { target: apiDeDesarrollo, changeOrigin: true },
      '/salud': { target: apiDeDesarrollo, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/preparacion.ts'],
    // El humo contra la demo de verdad (`*.demo.test.tsx`) entra en el `include`
    // como cualquier otro, pero `npm test` lo saca con `--exclude`: necesita el
    // backend levantado, y un CI que dependa de eso deja de ser una señal. Se
    // corre aparte con `npm run test:demo`. La exclusión vive en el script y no
    // acá para que ese comando pueda pedirlo por nombre — un archivo excluido en
    // la config no se corre ni nombrándolo.
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
