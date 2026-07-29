// El establecimiento activo, disponible en cualquier pantalla sin pasarlo de
// mano en mano. Es lo único que va en un contexto: el id y la `Config` los
// necesita casi todo, y encadenarlos por props haría que agregar una pantalla
// intermedia obligue a tocar las de arriba.

import { createContext, useContext } from 'react';
import type { Config } from './api/tipos';

export interface EstablecimientoActivo {
  id: string;
  /** Ausente mientras la API no lo devuelva; ver `RespuestaEstablecimiento`. */
  nombre?: string;
  config: Config;
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

/** Cómo se lo nombra en pantalla mientras el nombre no venga de la API. */
export const nombreVisible = (est: EstablecimientoActivo): string =>
  est.nombre !== undefined && est.nombre !== '' ? est.nombre : `establecimiento ${est.id.slice(0, 8)}`;
