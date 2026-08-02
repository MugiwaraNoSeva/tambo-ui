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
import {
  ProveedorEstablecimiento,
  puedeCargarEn,
  usarEstablecimiento,
  type SalidaDelTambo,
} from './establecimiento';
import { Alta } from './pantallas/Alta';
import { CargarEvento } from './pantallas/CargarEvento';
import { Conexion } from './pantallas/Conexion';
import { Corrida } from './pantallas/Corrida';
import { Cuenta } from './pantallas/Cuenta';
import { Ficha } from './pantallas/Ficha';
import { Login } from './pantallas/Login';
import { Panel } from './pantallas/Panel';
import { Partos } from './pantallas/Partos';
import { Rodeo } from './pantallas/Rodeo';
import { Tablero } from './pantallas/Tablero';
import { Tanque } from './pantallas/Tanque';
import { aPanel, aTablero, esRutaDeAdmin, ir, usarRuta, type Ruta } from './ruteo';
import { alCaerLaSesion, guardarToken, olvidarToken, tokenGuardado, type CaidaDeSesion } from './sesion';
import { ProveedorUsuario, usarUsuario } from './usuario';
import { esSinPermiso, usarPedido } from './usarPedido';

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
      {/* Acá se parte el árbol. El tambero elige tambo y de ahí no sale; el
          admin arranca en el panel, que no es de ningún tambo. */}
      {usuario.es_admin ? <ComoAdmin /> : <ConTambo />}
    </ProveedorUsuario>
  );
}

/**
 * El admin: el panel es su inicio, y el tambo se abre desde ahí.
 *
 * **No pasa por el selector**, y no es un atajo: el selector entra derecho
 * cuando hay un solo tambo —es el 90% de los tamberos y una lista de un elemento
 * es una pantalla de peaje—, y para el admin eso sería fatal. En una base recién
 * instalada hay exactamente un tambo, así que el admin entraría derecho a él y
 * **no vería el panel nunca**. El atajo es para el que tiene un tambo; el admin,
 * por definición, es el que los ve todos.
 *
 * Qué se dibuja lo deciden dos cosas y el orden importa:
 *
 *   1. si la ruta es del panel, el panel — aunque tenga un tambo abierto, porque
 *      un `#/admin` escrito o tocado es un pedido explícito de volver;
 *   2. si no, hace falta un tambo abierto. Sin él **también es el panel**: el
 *      hash no abre un tambo por su cuenta. Es la misma regla que ya rige del
 *      otro lado —al tambero que todavía no eligió, el selector le tapa
 *      cualquier hash— y por eso un enlace profundo a la ficha de un animal deja
 *      al admin en el panel hasta que elija en cuál de los tambos mirarla.
 *
 * El tambo abierto **no se guarda** en `localStorage` a diferencia del que elige
 * el tambero. Ahí es una preferencia que la próxima visita lee; acá nadie la
 * leería —el inicio del admin es el panel, decidido arriba—, y una preferencia
 * que se escribe y no se lee es un valor que envejece hasta que alguien le cree.
 */
function ComoAdmin() {
  const [tamboAbierto, setTamboAbierto] = useState<string | null>(null);
  const ruta = usarRuta();

  const entrarAlTambo = useCallback((id: string) => {
    setTamboAbierto(id);
    ir(aTablero());
  }, []);

  const volverAlPanel = useCallback(() => {
    setTamboAbierto(null);
    ir(aPanel());
  }, []);

  if (tamboAbierto === null || esRutaDeAdmin(ruta)) {
    return <Panel ruta={ruta} alEntrarAlTambo={entrarAlTambo} />;
  }

  // La misma puerta que usa el tambero, con otra salida. Escribirle una segunda
  // sería duplicar la verificación contra la API, la `Config`, el cálculo del
  // permiso y el manejo del rechazo de la puerta.
  return (
    <Conectado id={tamboAbierto} salida={{ rotulo: 'Volver al panel', irse: volverAlPanel }} />
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

/**
 * Qué tambo. La lista sale de `GET /establecimientos`, que devuelve **los míos**
 * —y todos si soy admin—, así que de acá salen los cuatro casos:
 *
 *   - **ninguno**: no le dieron acceso todavía. Lo dice el selector;
 *   - **uno solo**: se entra derecho. Es el 90% de la gente y una lista de un
 *     elemento es una pantalla de peaje;
 *   - **varios**: la lista, con el último elegido guardado;
 *   - **el guardado ya no está en la lista** —se lo revocaron, o es de otra
 *     demo—: al selector, sin dejarlo pegado. **El `localStorage` propone; la
 *     lista de la API decide.** Es la línea que evita que un id viejo deje la
 *     app arrancando en un error del que no se puede salir.
 */
function ConTambo() {
  const [elegido, setElegido] = useState<string | null>(establecimientoGuardado);
  const [aviso, setAviso] = useState<string | null>(null);
  // El tambo que la lista trae pero la puerta rechaza con 403. Se anota para no
  // volver a entrar solo: con un único tambo, "entrar derecho" y "volver al
  // selector" se turnarían para siempre. Anotado, entrar vuelve a ser un toque.
  const [reboto, setReboto] = useState<string | null>(null);
  const traer = useCallback(() => api.establecimientos(), []);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  const conectar = useCallback((id: string) => {
    guardarEstablecimiento(id);
    setAviso(null);
    setReboto(null);
    setElegido(id);
  }, []);

  const volverAlSelector = useCallback((porque: string | null, queReboto?: string) => {
    olvidarEstablecimiento();
    setAviso(porque);
    setElegido(null);
    if (queReboto !== undefined) setReboto(queReboto);
  }, []);

  if (cargando) {
    return (
      <Armazon titulo="Tambo">
        <Cargando que="Buscando tus tambos…" />
      </Armazon>
    );
  }

  if (error !== null || datos === null) {
    return (
      <Armazon titulo="Tambo">
        <Aviso titulo="No se pudo conectar">{error ?? 'El servidor no contestó.'}</Aviso>
        <button className="boton ancho secundario" type="button" onClick={recargar}>
          Reintentar
        </button>
      </Armazon>
    );
  }

  const tambos = datos.establecimientos;
  // Un solo tambo entra sin preguntar, y esto va **antes** de mirar el guardado:
  // si el guardado quedó de otra demo, con un solo tambo la respuesta correcta
  // sigue siendo entrar a ese y no mostrar una lista de uno.
  const unico = tambos.length === 1 ? (tambos[0]?.id ?? null) : null;
  const id = unico !== null && unico !== reboto ? unico : elegido;
  const enLaLista = id !== null && tambos.some((t) => t.id === id);

  if (!enLaLista) {
    return (
      <Conexion
        tambos={tambos}
        alConectar={conectar}
        // Que el guardado no esté en la lista **no** es un error del que haya que
        // pedir disculpas: le revocaron el permiso, o el id quedó de otra demo.
        // Se dice qué pasó y se muestra la lista, que es lo que lo resuelve.
        aviso={
          id === null
            ? aviso
            : 'El tambo que tenías elegido ya no está entre los tuyos. Elegí otro.'
        }
      />
    );
  }

  // Con un solo tambo no hay a dónde cambiar, así que el botón no está: es el
  // mismo criterio que no mostrar una lista de un elemento.
  return (
    <Conectado
      id={id}
      salida={{ rotulo: tambos.length > 1 ? 'Cambiar de tambo' : null, irse: volverAlSelector }}
    />
  );
}

/**
 * El tambo elegido, verificado contra la API: de acá salen el nombre del
 * encabezado y la `Config` que las pantallas necesitan, y por eso la
 * verificación se hace una sola vez y acá arriba.
 *
 * Un **403** en esta puerta vuelve al selector y no al login: la sesión está
 * bien y lo que falta es permiso sobre este tambo. Como un tambo sobre el que no
 * tengo permiso contesta 403 exista o no, el id revocado y el inventado se ven
 * igual — y los dos se arreglan eligiendo otro.
 */
function Conectado({ id, salida }: { id: string; salida: SalidaDelTambo }) {
  const usuario = usarUsuario();
  const { irse } = salida;
  const traer = useCallback(() => api.establecimiento(id), [id]);
  const { datos, cargando, error, causa } = usarPedido(traer);

  const sinPermiso = esSinPermiso(causa);
  useEffect(() => {
    if (!sinPermiso) return;
    irse('No tenés permiso sobre ese tambo. Elegí uno de los tuyos.', id);
  }, [sinPermiso, irse, id]);

  if (cargando || sinPermiso) {
    return (
      <Armazon titulo="Tambo">
        <Cargando que="Conectando con el tambo…" />
      </Armazon>
    );
  }

  if (error !== null || datos === null) {
    return (
      <Armazon titulo="Tambo">
        {/* Para el admin, acá también cae el **404** del id inventado en la
            barra de direcciones: el 403 parejo existe para no decirle a un
            extraño qué tambos hay, y él no es un extraño. Los dos se arreglan
            por la misma puerta, que es volver a donde se elige. */}
        <Aviso titulo="No se pudo conectar">{error ?? 'El servidor no contestó.'}</Aviso>
        <button className="boton ancho secundario" type="button" onClick={() => irse(null)}>
          {salida.rotulo ?? 'Elegir otro tambo'}
        </button>
      </Armazon>
    );
  }

  // El único lugar donde se calcula si este usuario puede cargar en este tambo.
  const activo = {
    id,
    nombre: datos.nombre,
    config: datos.config,
    puedeCargar: puedeCargarEn(usuario, id),
  };

  return (
    <ProveedorEstablecimiento value={activo}>
      <Pantallas salida={salida} />
    </ProveedorEstablecimiento>
  );
}

function Pantallas({ salida }: { salida: SalidaDelTambo }) {
  const { nombre } = usarEstablecimiento();
  const cruda = usarRuta();

  // **Las rutas del panel no existen de este lado.** Un `#/admin` tocado por
  // alguien que no es admin —un enlace viejo, una dirección compartida— cae en
  // el inicio como cualquier otro hash que no se entienda. Sin esta línea el
  // `switch` de abajo no matchea ninguna rama y la pantalla queda en blanco:
  // el árbol se partió arriba y este lado solo conoce sus propias rutas.
  const ruta: Ruta = esRutaDeAdmin(cruda) ? { nombre: 'tablero' } : cruda;

  switch (ruta.nombre) {
    // El tablero es el inicio y por eso lleva el nombre del tambo en el
    // encabezado y ninguna flecha de volver: no hay a dónde. Es un **lugar**, y
    // eso le pone la barra abajo y "Mi cuenta" arriba.
    //
    // Las tres salidas que vivían acá —cambiar de tambo, mi cuenta, salir— se
    // fueron: "Mi cuenta" al encabezado, y las otras dos adentro de esa pantalla.
    // El criterio es el inverso del de la barra y a propósito: lo que se hace
    // todo el día va abajo, lo que se hace una vez por turno va arriba y lejos.
    case 'tablero':
      return (
        <Armazon titulo={nombre} lugar>
          <Tablero />
        </Armazon>
      );

    case 'rodeo':
      return (
        <Armazon titulo="El rodeo" ancha lugar>
          <Rodeo />
        </Armazon>
      );

    // Estas tres arman su propio armazón: las dos primeras porque el título
    // lleva la caravana —un dato que todavía no llegó cuando esta función decide
    // qué dibujar— y la corrida porque su título y su vuelta salen del origen.
    case 'animal':
      return <Ficha id={ruta.id} />;
    case 'partos':
      return <Partos id={ruta.id} />;
    case 'cargar':
      return <CargarEvento id={ruta.id} tipo={ruta.tipo} />;
    case 'corrida':
      return <Corrida origen={ruta.origen} />;

    case 'alta':
      return <Alta />;
    case 'tanque':
      return <Tanque />;
    // La única de las tres salidas que no se puede resolver adentro de "Mi
    // cuenta" sola: irse del tambo lo sabe hacer `App`, que es quien lo abrió.
    case 'cuenta':
      return <Cuenta salida={salida} />;
  }
}
