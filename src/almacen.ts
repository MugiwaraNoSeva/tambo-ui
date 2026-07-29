// ─────────────────────────────────────────────────────────────────────────────
// Lo poco que la UI recuerda entre visitas.
//
// Hoy es una sola cosa: **qué establecimiento está activo**. Se elige una vez y
// queda guardado, porque un tambero trabaja en un tambo y volver a elegirlo cada
// mañana sería una pantalla de peaje. Cuando llegue la Fase 6 esto lo va a
// decir la sesión y este módulo se va a achicar, no a crecer.
//
// `localStorage` puede estar apagado (modo privado de algunos browsers) y tirar
// al leer. Envuelto en try/catch: sin almacenamiento la app funciona igual,
// solo que vuelve a preguntar el establecimiento cada vez.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'tambo.establecimiento';

export function establecimientoGuardado(): string | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === null || valor === '' ? null : valor;
  } catch {
    return null;
  }
}

export function guardarEstablecimiento(id: string): void {
  try {
    window.localStorage.setItem(CLAVE, id);
  } catch {
    // Sin almacenamiento se sigue: la elección vale para esta sesión.
  }
}

export function olvidarEstablecimiento(): void {
  try {
    window.localStorage.removeItem(CLAVE);
  } catch {
    // Ídem.
  }
}
