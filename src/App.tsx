// ─────────────────────────────────────────────────────────────────────────────
// El armazón: entrar, elegir tambo, conectarse, y de ahí en más rutear.
//
// Tres estados y el orden importa:
//
//   1. **sin token** → la pantalla de login, que es la única que se ve sin sesión;
//   2. **con token pero sin saber quién soy** → `GET /auth/yo`, el primer pedido
//      de la app. Es de la base y no del token —los permisos no viajan adentro—,
//      así que lo que vuelve es el estado de ahora: si esta mañana le revocaron
//      un tambo, se nota antes de dibujar nada;
//   3. **con usuario** → lo de siempre: el tambo elegido, verificado contra la
//      API, y las pantallas.
//
// Un token que ya no vale al arrancar **no muestra ningún error**: es el de
// ayer, venció durmiendo y explicárselo a alguien que todavía no hizo nada sería
// darle un problema que no tiene. Distinto es el 401 que llega **adentro**, con
// la sesión abierta —las 8 horas cumplidas a mitad de la mañana—: ese sí se
// explica, y si lo que se estaba haciendo era una carga, se dice que no se
// guardó. La diferencia entre los dos casos es `estabaAdentro`.
//
// El aviso de que la sesión se cayó llega **desde el cliente HTTP**, que es el
// único que ve los 401, por el callback de `sesion.ts`. Tiene que entrar por acá
// y no por la pantalla de turno porque la pantalla de turno está por
// desaparecer: el caso que manda es el 401 a mitad de una carga.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api/cliente';
import type { RespuestaLogin, Usuario } from './api/tipos';
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
import { Cuenta } from './pantallas/Cuenta';
import { Ficha } from './pantallas/Ficha';
import { Login } from './pantallas/Login';
import { Rodeo } from './pantallas/Rodeo';
import { Tablero } from './pantallas/Tablero';
import { Tanque } from './pantallas/Tanque';
import { aCuenta, aTablero, usarRuta } from './ruteo';
import { alCaerLaSesion, guardarToken, olvidarToken, tokenGuardado, type CaidaDeSesion } from './sesion';
import { ProveedorUsuario, usarSalir } from './usuario';
import { usarPedido } from './usarPedido';

export function App() {
  const [hayToken, setHayToken] = useState(() => tokenGuardado() !== null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [caida, setCaida] = useState<CaidaDeSesion | null>(null);

  // Lo que distingue "el token de ayer no valía" de "se me cortó la sesión en la
  // mano". Es un ref y no un estado porque lo lee el callback de abajo, que se
  // registra una sola vez y no puede depender de un valor que cambia.
  const estabaAdentro = useRef(false);
  useEffect(() => {
    estabaAdentro.current = usuario !== null;
  }, [usuario]);

  useEffect(
    () =>
      alCaerLaSesion((quePaso) => {
        setCaida(estabaAdentro.current ? quePaso : null);
        setUsuario(null);
        setHayToken(false);
      }),
    [],
  );

  const entrar = useCallback((respuesta: RespuestaLogin) => {
    guardarToken(respuesta.token);
    setCaida(null);
    setHayToken(true);
    // El login ya trae el usuario con sus permisos: pedir `/auth/yo` acá sería
    // un viaje para preguntar lo que acabamos de recibir.
    setUsuario(respuesta.usuario);
  }, []);

  const salir = useCallback(() => {
    olvidarToken();
    setCaida(null);
    setHayToken(false);
    setUsuario(null);
    // El tambo elegido **no** se olvida: no es un secreto, y el mismo tambero
    // que sale y vuelve a entrar no tiene por qué volver a elegirlo.
  }, []);

  if (!hayToken) return <Login alEntrar={entrar} caida={caida} />;
  if (usuario === null) return <Identificando alSaberQuienSoy={setUsuario} />;

  return (
    <ProveedorUsuario value={{ usuario, salir }}>
      <ConTambo />
    </ProveedorUsuario>
  );
}

/**
 * El paso 2: hay token guardado y todavía no sabemos de quién es.
 *
 * Si contesta 401, esta pantalla no muestra nada: el cliente ya avisó, `App` ya
 * cambió a `Login` y este componente se fue. Lo que sí se muestra es el error de
 * red, con su reintento — un celular sin señal en el arranque no es una sesión
 * caída y mandarlo al login no lo arreglaría.
 */
function Identificando({ alSaberQuienSoy }: { alSaberQuienSoy: (usuario: Usuario) => void }) {
  const traer = useCallback(() => api.yo(), []);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  useEffect(() => {
    if (datos !== null) alSaberQuienSoy(datos.usuario);
  }, [datos, alSaberQuienSoy]);

  if (cargando || datos !== null) {
    return (
      <Armazon titulo="Tambo">
        <Cargando que="Entrando…" />
      </Armazon>
    );
  }

  return (
    <Armazon titulo="Tambo">
      <Aviso titulo="No se pudo entrar">{error ?? 'El servidor no contestó.'}</Aviso>
      <button className="boton ancho secundario" type="button" onClick={recargar}>
        Reintentar
      </button>
    </Armazon>
  );
}

function ConTambo() {
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
  const salir = usarSalir();
  const ruta = usarRuta();

  switch (ruta.nombre) {
    // El tablero es el inicio y por eso lleva el nombre del tambo en el
    // encabezado y ninguna flecha de volver: no hay a dónde.
    case 'tablero':
      return (
        <Armazon titulo={nombre}>
          <Tablero />
          {/* Las tres salidas del tablero, juntas y al final: cambiar de tambo
              (la sesión sigue), mi cuenta, y salir (la sesión se va). */}
          <div className="acciones">
            <button className="boton secundario" type="button" onClick={alDesconectar}>
              Cambiar de tambo
            </button>
            <a className="boton secundario" href={aCuenta()}>
              Mi cuenta
            </a>
            <button className="boton secundario" type="button" onClick={salir}>
              Salir
            </button>
          </div>
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
    case 'cuenta':
      return <Cuenta />;
  }
}
