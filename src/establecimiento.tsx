// El establecimiento activo, disponible en cualquier pantalla sin pasarlo de
// mano en mano. Es lo único que va en un contexto: el id y la `Config` los
// necesita casi todo, y encadenarlos por props haría que agregar una pantalla
// intermedia obligue a tocar las de arriba.

import { createContext, useContext } from 'react';
import type { Config, Usuario } from './api/tipos';

export interface EstablecimientoActivo {
  id: string;
  nombre: string;
  config: Config;
  /**
   * ¿Este usuario puede cargar **en este tambo**? Va acá, al lado del `nombre` y
   * la `Config`, porque es un dato del establecimiento activo tanto como ellos:
   * el mismo usuario puede escribir en uno y solo mirar en otro.
   *
   * **Ninguna pantalla lo recalcula.** Es una sola cuenta y vive en un solo
   * lugar: repetida en cinco pantallas, la sexta se olvida de la mitad del
   * admin y le muestra una UI de solo lectura a quien puede todo.
   */
  puedeCargar: boolean;
}

/**
 * La cuenta completa, escrita una vez.
 *
 * Las dos mitades importan igual. El permiso de `escritura` sobre **este** tambo
 * es la obvia; la otra es que **el admin puede todo y viene con `permisos: []`**,
 * porque no necesita que le den permiso sobre ningún tambo. Mirar solo
 * `permisos` deja al administrador sin poder cargar nada en ningún lado.
 *
 * Y esto **no es seguridad**: la cerradura está en la API, que contesta 403.
 * Esto es una cortesía con el que mira, para que no se le ofrezca un formulario
 * cuyo único final posible es un rechazo.
 */
export function puedeCargarEn(usuario: Usuario, establecimientoId: string): boolean {
  if (usuario.es_admin) return true;
  return usuario.permisos.some(
    (p) => p.establecimiento_id === establecimientoId && p.rol === 'escritura',
  );
}

const Contexto = createContext<EstablecimientoActivo | null>(null);

export const ProveedorEstablecimiento = Contexto.Provider;

/** El establecimiento activo. Tira si se usa fuera del proveedor, que sería un
 *  error de programación y no un caso a manejar en pantalla. */
export function usarEstablecimiento(): EstablecimientoActivo {
  const valor = useContext(Contexto);
  if (valor === null) {
    throw new Error('usarEstablecimiento() fuera de <ProveedorEstablecimiento>');
  }
  return valor;
}
