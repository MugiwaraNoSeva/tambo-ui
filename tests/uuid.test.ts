// El generador de uuid. Lo que importa probar no es que sea aleatorio —eso lo
// da `getRandomValues`— sino que **tenga la forma que la API exige**: `api/` la
// valida con una regex y contesta 400 si no da, así que un uuid mal armado se
// vería como una carga que no entra y nadie sabría por qué.

import { describe, expect, it, vi } from 'vitest';
import { nuevoUuid } from '../src/uuid';

/** La misma regex que `esUuid` de `api/src/contexto.ts`. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('nuevoUuid', () => {
  it('tiene la forma que la API valida', () => {
    expect(nuevoUuid()).toMatch(UUID);
  });

  it('marca versión 4 y variante RFC 4122', () => {
    // Sin esto el string tiene forma de uuid y no es un uuid de ninguna versión.
    for (let i = 0; i < 50; i += 1) {
      const uuid = nuevoUuid() ?? '';
      expect(uuid[14]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
    }
  });

  it('no repite', () => {
    const generados = new Set(Array.from({ length: 500 }, nuevoUuid));
    expect(generados.size).toBe(500);
  });

  it('no usa `crypto.randomUUID`, que sobre HTTP no existe (decisión 67)', () => {
    // El celular del tambo entra por http://192.168.x.x, que no es un contexto
    // seguro: ahí `randomUUID` es `undefined` y esto tiene que andar igual.
    const randomUUID = vi.fn();
    vi.stubGlobal('crypto', {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      randomUUID,
    });

    expect(nuevoUuid()).toMatch(UUID);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('sin fuente de aleatoriedad devuelve undefined en vez de inventar una', () => {
    // Un id con poca entropía puede chocar con el de otro evento y hacer que la
    // API rechace una carga buena por duplicada — peor que no mandar id, porque
    // sin id el servidor genera el suyo y solo se pierde la protección.
    vi.stubGlobal('crypto', {
      getRandomValues: () => {
        throw new Error('sin crypto');
      },
    });

    expect(nuevoUuid()).toBeUndefined();
  });
});
