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
import { Aviso, Cargando } from './componentes/basicos';
import { ProveedorEstablecimiento, usarEstablecimiento } from './establecimiento';
import { Alta } from './pantallas/Alta';
import { CargarEvento } from './pantallas/CargarEvento';
import { Conexion } from './pantallas/Conexion';
import { Ficha } from './pantallas/Ficha';
import { Rodeo } from './pantallas/Rodeo';
import { Tablero } from './pantallas/Tablero';
import { Tanque } from './pantallas/Tanque';
import { aTablero, usarRuta } from './ruteo';
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

function Pantallas({ alDesconectar }: { alDesconectar: () => void }) {
  const { nombre } = usarEstablecimiento();
  const ruta = usarRuta();

  switch (ruta.nombre) {
    // El tablero es el inicio y por eso lleva el nombre del tambo en el
    // encabezado y ninguna flecha de volver: no hay a dónde.
    case 'tablero':
      return (
        <Armazon titulo={nombre}>
          <Tablero />
          <button className="boton ancho secundario" type="button" onClick={alDesconectar}>
            Cambiar de tambo
          </button>
        </Armazon>
      );

    case 'rodeo':
      return (
        <Armazon titulo="El rodeo" volverA={aTablero()}>
          <Rodeo />
        </Armazon>
      );

    // Estas dos arman su propio armazón: el título lleva la caravana, que es un
    // dato que todavía no llegó cuando esta función decide qué dibujar.
    case 'animal':
      return <Ficha id={ruta.id} />;
    case 'cargar':
      return <CargarEvento id={ruta.id} />;

    case 'alta':
      return <Alta />;
    case 'tanque':
      return <Tanque />;
  }
}
