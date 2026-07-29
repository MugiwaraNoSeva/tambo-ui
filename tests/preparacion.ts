// Preparación común de la suite.
//
// Tres cosas: los matchers de jest-dom (`toBeInTheDocument` y compañía), un
// `localStorage` limpio entre tests —la app guarda el establecimiento ahí, y un
// test que lo deja puesto le cambia la pantalla inicial al siguiente— y el
// reloj del servidor olvidado.
//
// Lo del reloj no es paranoia: `reloj.ts` guarda la última fecha vista en una
// variable de módulo, y los módulos se comparten dentro de un archivo de test.
// Sin esto, un test que pasa por el tablero le dejaría la fecha puesta al
// siguiente, y el que probara el respaldo del dispositivo pasaría por el motivo
// equivocado.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { olvidarFechaDelServidor } from '../src/reloj';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
  olvidarFechaDelServidor();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
