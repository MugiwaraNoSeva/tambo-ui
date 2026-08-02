// Preparación común de la suite.
//
// Cuatro cosas: los matchers de jest-dom (`toBeInTheDocument` y compañía), un
// `localStorage` limpio entre tests —la app guarda el establecimiento ahí, y un
// test que lo deja puesto le cambia la pantalla inicial al siguiente—, el
// reloj del servidor olvidado, y un `scrollTo` que no hace nada.
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

// jsdom no tiene layout y por lo tanto no scrollea: su `window.scrollTo` existe
// solo para tirar un "Not implemented" por consola. El armazón lo llama en cada
// cambio de pantalla, así que sin esto la suite entera se llena de un error que
// no es un error. Es un no-op y no un espía a propósito: que la llamada ocurra
// no prueba que la pantalla haya subido, y afirmarlo sería probar el mock.
window.scrollTo = () => {};

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
