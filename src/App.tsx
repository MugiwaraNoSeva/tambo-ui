// ─────────────────────────────────────────────────────────────────────────────
// El armazón: elegir tambo, conectarse, y de ahí en más rutear.
//
// La app tiene dos modos y no más: sin establecimiento elegido muestra la
// pantalla de conexión; con uno elegido, lo verifica contra la API y recién
// entonces dibuja lo demás. La verificación no es ceremonia — un id guardado
// puede haber quedado de una demo anterior, y la base embebida nace vacía cada
// vez.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import { api } from './api/cliente';
import {
  establecimientoGuardado,
  guardarEstablecimiento,
  olvidarEstablecimiento,
} from './almacen';
import { Aviso, Cargando, Tarjeta } from './componentes/basicos';
import { ProveedorEstablecimiento } from './establecimiento';
import { Conexion } from './pantallas/Conexion';
import { usarPedido } from './usarPedido';

export function App() {
  const [id, setId] = useState<string | null>(establecimientoGuardado);

  const conectar = useCallback((elegido: string) => {
    guardarEstablecimiento(elegido);
    setId(elegido);
  }, []);

  const desconectar = useCallback(() => {
    olvidarEstablecimiento();
    setId(null);
  }, []);

  if (id === null) return <Conexion alConectar={conectar} />;
  return <Conectado id={id} alDesconectar={desconectar} />;
}

function Conectado({ id, alDesconectar }: { id: string; alDesconectar: () => void }) {
  const traer = useCallback(() => api.establecimiento(id), [id]);
  const { datos, cargando, error } = usarPedido(traer);

  if (cargando) {
    return (
      <div className="app">
        <header className="encabezado">
          <h1>Tambo</h1>
        </header>
        <main className="contenido">
          <Cargando que="Conectando con el tambo…" />
        </main>
      </div>
    );
  }

  if (error !== null || datos === null) {
    return (
      <div className="app">
        <header className="encabezado">
          <h1>Tambo</h1>
        </header>
        <main className="contenido">
          <Aviso titulo="No se pudo conectar">{error ?? 'El servidor no contestó.'}</Aviso>
          <button className="boton ancho secundario" type="button" onClick={alDesconectar}>
            Elegir otro tambo
          </button>
        </main>
      </div>
    );
  }

  const activo = { id, nombre: datos.nombre, config: datos.config };

  return (
    <ProveedorEstablecimiento value={activo}>
      <div className="app">
        <header className="encabezado">
          <h1>{activo.nombre}</h1>
        </header>
        <main className="contenido">
          <Tarjeta titulo={`Conectado a ${activo.nombre}`}>
            <p className="vacio">
              Las pantallas del tambero —el tablero de la mañana, el rodeo y la carga— llegan en
              las partes que siguen.
            </p>
          </Tarjeta>
          <button className="boton ancho secundario" type="button" onClick={alDesconectar}>
            Cambiar de tambo
          </button>
        </main>
      </div>
    </ProveedorEstablecimiento>
  );
}
