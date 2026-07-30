// Quién está usando la app, disponible en cualquier pantalla sin pasarlo de
// mano en mano. Mismo criterio que `establecimiento.tsx`: va a un contexto lo
// que necesita casi todo y lo que, encadenado por props, obligaría a tocar las
// pantallas de arriba cada vez que se agrega una en el medio.
//
// Son dos cosas y por eso hay dos hooks: **quién soy** (que lo miran el tablero,
// la cuenta y —desde la Parte 4— el cálculo de si puedo cargar) y **cómo me
// voy** (que lo llaman el botón de salir y la pantalla de la cuenta, a dos
// profundidades distintas).

import { createContext, useContext } from 'react';
import type { Usuario } from './api/tipos';

export interface SesionActiva {
  usuario: Usuario;
  /** Borra el token y vuelve al login. Es "Salir", no "Cambiar de tambo". */
  salir: () => void;
}

const Contexto = createContext<SesionActiva | null>(null);

export const ProveedorUsuario = Contexto.Provider;

function usarContexto(): SesionActiva {
  const valor = useContext(Contexto);
  if (valor === null) throw new Error('usarUsuario() fuera de <ProveedorUsuario>');
  return valor;
}

/** El usuario de esta sesión, tal como lo devolvió `/auth/yo`. */
export const usarUsuario = (): Usuario => usarContexto().usuario;

/** Salir: borrar el token y volver al login. */
export const usarSalir = (): (() => void) => usarContexto().salir;
