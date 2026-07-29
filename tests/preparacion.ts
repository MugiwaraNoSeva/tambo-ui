// Preparación común de la suite.
//
// Dos cosas: los matchers de jest-dom (`toBeInTheDocument` y compañía) y un
// `localStorage` limpio entre tests — la app guarda el establecimiento ahí, y
// un test que lo deja puesto le cambia la pantalla inicial al siguiente.

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
