// ─────────────────────────────────────────────────────────────────────────────
// El armazón: elegir tambo, conectarse, y de ahí en más rutear.
//
// La app tiene dos modos y no más: sin establecimiento elegido muestra la
// pantalla de conexión; con uno elegido, lo verifica contra la API y recién
// entonces dibuja lo demás. La verificación no es ceremonia — un id guardado
// puede haber quedado de una demo anterior, y la base embebida nace vacía cada
// vez.
//
// La verificación se hace **una sola vez, acá arriba**: de ella salen el nombre
// que va en el encabezado y la `Config` que las pantallas necesitan, así que
// ninguna de abajo tiene que volver a preguntar quién es el tambo.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react';
import { api } from './api/cliente';
import {
  establecimientoGuardado,
  guardarEstablecimiento,
  olvidarEstablecimiento,
} from './almacen';
import { Armazon } from './componentes/armazon';
import { Aviso, Cargando, Tarjeta } from './componentes/basicos';
import { ProveedorEstablecimiento, usarEstablecimiento } from './establecimiento';
import { Conexion } from './pantallas/Conexion';
import { Tablero } from './pantallas/Tablero';
import { aTablero, usarRuta, type Ruta } from './ruteo';
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
      <Armazon titulo="Tambo">
        <Cargando que="Conectando con el tambo…" />
      </Armazon>
    );
  }

  if (error !== null || datos === null) {
    return (
      <Armazon titulo="Tambo">
        <Aviso titulo="No se pudo conectar">{error ?? 'El servidor no contestó.'}</Aviso>
        <button className="boton ancho secundario" type="button" onClick={alDesconectar}>
          Elegir otro tambo
        </button>
      </Armazon>
    );
  }

  const activo = { id, nombre: datos.nombre, config: datos.config };

  return (
    <ProveedorEstablecimiento value={activo}>
      <Pantallas alDesconectar={alDesconectar} />
    </ProveedorEstablecimiento>
  );
}

/** El título de la barra de arriba, uno por ruta. */
const TITULOS: Record<Exclude<Ruta['nombre'], 'tablero'>, string> = {
  rodeo: 'El rodeo',
  animal: 'Ficha del animal',
  cargar: 'Cargar un evento',
  alta: 'Dar de alta',
  tanque: 'El tanque',
};

function Pantallas({ alDesconectar }: { alDesconectar: () => void }) {
  const { nombre } = usarEstablecimiento();
  const ruta = usarRuta();

  // El tablero es el inicio y por eso lleva el nombre del tambo en el
  // encabezado y ninguna flecha de volver: no hay a dónde.
  if (ruta.nombre === 'tablero') {
    return (
      <Armazon titulo={nombre}>
        <Tablero />
        <button className="boton ancho secundario" type="button" onClick={alDesconectar}>
          Cambiar de tambo
        </button>
      </Armazon>
    );
  }

  return (
    <Armazon titulo={TITULOS[ruta.nombre]} volverA={aTablero()}>
      <Tarjeta titulo="Todavía no">
        <p className="vacio">
          Esta pantalla llega en la parte que sigue. Del tablero para acá ya anda todo.
        </p>
      </Tarjeta>
    </Armazon>
  );
}
