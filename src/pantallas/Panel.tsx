// ─────────────────────────────────────────────────────────────────────────────
// El panel del admin. Tres pantallas encadenadas y el orden es el trabajo:
//
//   1. **los tambos** — la lista, crear uno, y ver los archivados si hace falta;
//   2. **un tambo** — un menú de qué querés hacer con él: entrar a usarlo,
//      administrar su gente, o editarlo y archivarlo;
//   3. **la gente de ese tambo** — quién entra, con qué permiso, y la persona
//      entera (nombre, contraseña, si está activa, si es admin).
//
// El menú del medio existe porque son cosas de distinta naturaleza y con
// distinta frecuencia: entrar al tambo es lo de todos los días, repartir
// permisos es de vez en cuando, y archivarlo pasa una vez en la vida. Apiladas
// en una sola pantalla, la de todos los días queda abajo de las otras dos.
//
// **Esto no es de un tambo**, en el sentido del árbol: se dibuja afuera del
// establecimiento activo. La lista no pertenece a ninguno, y la gente de uno se
// mira sin estar conectado a él. `App` parte el árbol una sola vez y este
// archivo es el otro lado.
//
// Nada de acá protege nada: la cerradura es el 403 de la API, que estas rutas se
// comen enteras si las pide alguien que no es admin.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import type { EstablecimientoDeLaLista, Rol, UsuarioAdmin } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo } from '../componentes/formulario';
import {
  aPanel,
  aPanelTambo,
  aPanelTamboGente,
  aPanelUsuarios,
  ir,
  type Ruta,
} from '../ruteo';
import { usarSalir, usarUsuario } from '../usuario';
import { mensajeDe, usarPedido } from '../usarPedido';
import { Cuenta } from './Cuenta';
import { AltaDePersona, FichaDePersona, Personas } from './Personas';

export function Panel({
  ruta,
  alEntrarAlTambo,
}: {
  ruta: Ruta;
  alEntrarAlTambo: (id: string) => void;
}) {
  switch (ruta.nombre) {
    case 'panel-tambo':
      return <MenuDelTambo id={ruta.id} alEntrarAlTambo={alEntrarAlTambo} />;

    case 'panel-tambo-gente':
      return <GenteDelTambo id={ruta.id} />;

    case 'panel-usuarios':
      return <Personas />;

    // "Mi cuenta" es la única pantalla que vive en los dos árboles: la
    // contraseña es de la persona y no del tambo. Y en una base recién instalada
    // es la única forma que tiene el admin de cambiar la suya — el despliegue lo
    // manda a hacerlo antes de que exista un solo tambo.
    case 'cuenta':
      return <Cuenta volverA={aPanel()} />;

    // Todo lo demás es la lista, incluido el hash de una pantalla de tambo
    // cuando todavía no hay ninguno abierto (ver `ComoAdmin`).
    default:
      return <ListaDeTambos />;
  }
}

// ── 1. Los tambos ────────────────────────────────────────────────────────────

/**
 * La lista de tambos, que es el inicio del admin.
 *
 * Son **dos pedidos y no uno**, y el segundo es el que dice cuánta gente entra a
 * cada tambo: no hay endpoint de "usuarios de este establecimiento" y no hace
 * falta, porque `GET /usuarios` trae a todos con sus permisos. Si ese segundo
 * pedido se cae, la lista se dibuja igual **sin las cuentas**: el tambo al que
 * hay que entrar es lo que se vino a buscar, y perderlo por un dato de al lado
 * sería la pantalla equivocada (es el criterio de la decisión 56).
 */
function ListaDeTambos() {
  const usuario = usarUsuario();
  const salir = usarSalir();
  const [conArchivados, setConArchivados] = useState(false);
  const traerTambos = useCallback(() => api.establecimientos(conArchivados), [conArchivados]);
  const tambos = usarPedido(traerTambos);
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);

  if (tambos.cargando && tambos.datos === null) {
    return (
      <Armazon titulo="Administración">
        <Cargando que="Buscando los tambos…" />
      </Armazon>
    );
  }

  if (tambos.error !== null || tambos.datos === null) {
    return (
      <Armazon titulo="Administración">
        <TarjetaCaida titulo="Los tambos" error={tambos.error} reintentar={tambos.recargar} />
      </Armazon>
    );
  }

  const lista = tambos.datos.establecimientos;
  const cuentaDe = (est: string): number | null =>
    personas.datos === null
      ? null
      : personas.datos.usuarios.filter((u) =>
          u.permisos.some((p) => p.establecimiento_id === est),
        ).length;

  return (
    <Armazon titulo="Administración">
      {lista.length === 0 && !conArchivados ? (
        <PrimerTambo alCrear={tambos.recargar} nombre={usuario.nombre} />
      ) : (
        <>
          <Tarjeta titulo="Los tambos" subtitulo="Tocá uno para ver qué se puede hacer con él.">
            <ul className="lista">
              {lista.map((tambo) => (
                <li key={tambo.id}>
                  <a className="fila" href={aPanelTambo(tambo.id)}>
                    <span className="nombre-tambo">{tambo.nombre}</span>
                    {tambo.archivado && <span className="etiqueta gris">archivado</span>}
                    <span className="renglon">{rotuloDeCuenta(cuentaDe(tambo.id))}</span>
                    <span className="flecha" aria-hidden="true">
                      ›
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <NuevoTambo alCrear={tambos.recargar} />
        </>
      )}

      {/* Un botón y no una casilla: los archivados no son un filtro que uno deja
          puesto, son algo que se va a buscar una vez. */}
      <button
        className="boton ancho secundario"
        type="button"
        onClick={() => setConArchivados((v) => !v)}
      >
        {conArchivados ? 'Ocultar los archivados' : 'Ver también los archivados'}
      </button>

      <div className="acciones">
        <a className="boton secundario" href={aPanelUsuarios()}>
          Todas las personas
        </a>
        <a className="boton secundario" href="#/cuenta">
          Mi cuenta
        </a>
        <button className="boton secundario" type="button" onClick={salir}>
          Salir
        </button>
      </div>
    </Armazon>
  );
}

/**
 * La cuenta de gente de un tambo, que es **la que tiene permiso propio**.
 *
 * Los administradores entran a todos y no figuran en el reparto de ninguno
 * (vienen con `permisos: []`), así que sumarlos acá sería inventar un número que
 * no corresponde a ninguna lista. Quiénes son se dice adentro del tambo, que es
 * donde se puede decir bien.
 */
const rotuloDeCuenta = (cuantos: number | null): string => {
  if (cuantos === null) return '';
  if (cuantos === 0) return 'Nadie con permiso todavía';
  return cuantos === 1 ? '1 persona con permiso' : `${cuantos} personas con permiso`;
};

/**
 * El vacío del panel, que es **la primera pantalla de producción**.
 *
 * En una base recién instalada no existe ningún establecimiento y el único
 * usuario es el admin. Hasta la tanda del panel, acá se le imprimían tres `curl`
 * y un párrafo explicando que la UI no administraba. Ahora administra: lo que va
 * es el formulario que crea el primer tambo.
 */
function PrimerTambo({ nombre, alCrear }: { nombre: string; alCrear: () => void }) {
  return (
    <Tarjeta titulo={`Hola, ${nombre}`}>
      <p className="vacio">
        Todavía no hay ningún tambo, y el que los crea sos vos: sos administrador. Empezá por
        crearlo; después vas a poder darle acceso a la gente que lo va a usar.
      </p>
      <FormularioDeTambo alCrear={alCrear} rotulo="Crear el primer tambo" />
    </Tarjeta>
  );
}

function NuevoTambo({ alCrear }: { alCrear: () => void }) {
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button className="boton ancho secundario" type="button" onClick={() => setAbierto(true)}>
        Crear un tambo
      </button>
    );
  }

  return (
    <Tarjeta titulo="Un tambo nuevo">
      <FormularioDeTambo
        alCrear={() => {
          setAbierto(false);
          alCrear();
        }}
        rotulo="Crear el tambo"
      />
    </Tarjeta>
  );
}

/**
 * Un campo y nada más: **el nombre**.
 *
 * La `Config` no se pide ni se ofrece, ni al crear ni al editar. Son diecisiete
 * números que se validan entre ellos —el mínimo de gestación contra el máximo,
 * el secado contra el parto probable— y que deciden si una preñez es plausible.
 * Ofrecerlos al pasar, al lado del nombre, es ofrecer que alguien cambie sin
 * querer con qué valida el dominio. La API los acepta; cuando haga falta
 * tocarlos, va a ser en una pantalla que se tome el trabajo en serio.
 */
function FormularioDeTambo({ alCrear, rotulo }: { alCrear: () => void; rotulo: string }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await api.crearEstablecimiento({ nombre: nombre.trim() });
      setNombre('');
      alCrear();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Campo etiqueta="Nombre del tambo" ayuda="El que la gente reconoce, no un código.">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="La Querencia"
          required
        />
      </Campo>
      <button className="boton ancho" type="submit" disabled={guardando || nombre.trim() === ''}>
        {guardando ? 'Creando…' : rotulo}
      </button>
      {error !== null && <Aviso titulo="No se pudo crear">{error}</Aviso>}
    </form>
  );
}

// ── 2. Un tambo: qué se puede hacer con él ───────────────────────────────────

/**
 * El menú del tambo. Tres cosas, y las tres son de distinta naturaleza:
 *
 *   · **entrar** — usarlo como cualquiera de su gente. Es lo de todos los días y
 *     por eso es la acción principal;
 *   · **su gente** — quién entra, con qué permiso, y editar a la persona;
 *   · **editarlo** — el nombre, y archivarlo.
 *
 * Estaban las tres apiladas en una sola pantalla y la de todos los días quedaba
 * abajo de las otras dos.
 */
function MenuDelTambo({
  id,
  alEntrarAlTambo,
}: {
  id: string;
  alEntrarAlTambo: (id: string) => void;
}) {
  const traer = useCallback(() => api.establecimiento(id), [id]);
  const tambo = usarPedido(traer);
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);

  // `&& datos === null` es lo que hace que **recargar no desmonte la pantalla**.
  // Sin eso, guardar un cambio la manda de vuelta a "cargando", y al volver de
  // ahí el formulario que se estaba usando aparece cerrado: se pierde el lugar
  // por haber hecho lo que la pantalla pedía. Lo encontró el humo contra la demo
  // de verdad, donde renombrar y archivar son dos gestos seguidos.
  if (tambo.cargando && tambo.datos === null) {
    return (
      <Armazon titulo="El tambo" volverA={aPanel()}>
        <Cargando que="Buscando el tambo…" />
      </Armazon>
    );
  }

  // Acá cae el 404 del id escrito a mano en la barra de direcciones: para el
  // admin la puerta contesta "no existe" y no 403, porque el 403 parejo está
  // para no decirle a un extraño qué tambos hay, y él no es un extraño.
  if (tambo.error !== null || tambo.datos === null) {
    return (
      <Armazon titulo="El tambo" volverA={aPanel()}>
        <Aviso titulo="No se pudo abrir">{tambo.error ?? 'El servidor no contestó.'}</Aviso>
        <a className="boton ancho secundario" href={aPanel()}>
          Volver al panel
        </a>
      </Armazon>
    );
  }

  const { nombre, archivado } = tambo.datos;
  const cuantos =
    personas.datos === null
      ? null
      : personas.datos.usuarios.filter((u) => u.permisos.some((p) => p.establecimiento_id === id))
          .length;

  return (
    <Armazon titulo={nombre} volverA={aPanel()}>
      {archivado && (
        <Aviso tono="atencion" titulo="Este tambo está archivado">
          Se puede mirar todo lo que tiene —el rodeo, las fichas, el historial— pero no cargar nada
          nuevo: la API rechaza las cargas hasta que alguien lo desarchive.
        </Aviso>
      )}

      <Tarjeta titulo="Qué querés hacer">
        <ul className="lista">
          <li>
            <button className="fila" type="button" onClick={() => alEntrarAlTambo(id)}>
              <span className="nombre-tambo">Entrar al tambo</span>
              <span className="renglon">
                {archivado
                  ? 'Mirarlo como cualquiera de su gente. Cargar, no.'
                  : 'Usarlo como cualquiera de su gente: cargás, das de alta y anulás.'}
              </span>
              <span className="flecha" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
          <li>
            <a className="fila" href={aPanelTamboGente(id)}>
              <span className="nombre-tambo">Su gente</span>
              <span className="renglon">
                {cuantos === null ? 'Quién entra y con qué permiso.' : rotuloDeCuenta(cuantos)}
              </span>
              <span className="flecha" aria-hidden="true">
                ›
              </span>
            </a>
          </li>
        </ul>
      </Tarjeta>

      <EditarTambo
        id={id}
        nombre={nombre}
        archivado={archivado}
        alCambiar={tambo.recargar}
      />
    </Armazon>
  );
}

/**
 * Editar el tambo y archivarlo.
 *
 * **Archivar es la baja que este sistema tiene**, y no hay otra: no existe
 * `DELETE /establecimientos/{est}` porque del tambo cuelgan sus animales, su log
 * y sus permisos, y el log no admite borrados (decisión 91). Por eso el botón no
 * dice "eliminar" ni pide confirmación con cara de irreversible: lo que hace se
 * deshace con el mismo botón, y lo que hay que explicar es qué cambia.
 */
function EditarTambo({
  id,
  nombre,
  archivado,
  alCambiar,
}: {
  id: string;
  nombre: string;
  archivado: boolean;
  alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(nombre);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(cambio: { nombre?: string; archivado?: boolean }) {
    setGuardando(true);
    setError(null);
    try {
      await api.editarEstablecimiento(id, cambio);
      alCambiar();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <button className="boton ancho secundario" type="button" onClick={() => setAbierto(true)}>
        Editar el tambo
      </button>
    );
  }

  return (
    <Tarjeta titulo="El tambo">
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar({ nombre: nuevo.trim() });
        }}
      >
        <Campo etiqueta="Nombre">
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} required />
        </Campo>
        <button
          className="boton chico secundario"
          type="submit"
          disabled={guardando || nuevo.trim() === '' || nuevo.trim() === nombre}
        >
          Cambiar el nombre
        </button>
      </form>

      <p className="renglon">
        Los parámetros del dominio —días de gestación, período de espera, umbral de secado— no se
        tocan desde acá: son diecisiete números que se validan entre ellos y deciden qué cargas
        acepta el tambo.
      </p>

      <h3>{archivado ? 'Desarchivar' : 'Archivar'}</h3>
      <p className="renglon">
        {archivado
          ? 'Vuelve a la lista y se puede volver a cargar en él.'
          : 'Sale de la lista y deja de aceptar cargas. Todo lo que tiene se sigue mirando: un tambo no se borra, porque su historial no se borra.'}
      </p>
      <button
        className={`boton chico ${archivado ? 'secundario' : 'peligro'}`}
        type="button"
        disabled={guardando}
        onClick={() => void guardar({ archivado: !archivado })}
      >
        {archivado ? 'Desarchivar el tambo' : 'Archivar el tambo'}
      </button>

      {error !== null && <Aviso titulo="No se pudo guardar">{error}</Aviso>}

      <button className="boton ancho secundario" type="button" onClick={() => setAbierto(false)}>
        Listo
      </button>
    </Tarjeta>
  );
}

// ── 3. La gente de un tambo ──────────────────────────────────────────────────

/**
 * Quién entra a este tambo, con qué permiso, y la persona entera.
 *
 * La lista sale de `GET /usuarios` filtrada por `permisos`, y tiene **tres
 * trampas** que la respuesta obvia no ve. Las tres están escritas donde pasan:
 *
 *   1. los administradores no figuran en el reparto de ningún tambo y entran a
 *      todos igual (`RepartoAjeno`);
 *   2. los desactivados sí figuran, y **no entran** (la ficha lo dice);
 *   3. la misma respuesta trae a todo el sistema, así que dar acceso a alguien
 *      que ya existe no necesita otro pedido (`DarAcceso`).
 */
function GenteDelTambo({ id }: { id: string }) {
  const traerTambo = useCallback(() => api.establecimiento(id), [id]);
  const tambo = usarPedido(traerTambo);
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);
  const traerTambos = useCallback(() => api.establecimientos(true), []);
  const tambos = usarPedido(traerTambos);
  const [guardando, setGuardando] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  /** La recién creada, para dejarla elegida en "dar acceso", que es lo que sigue. */
  const [recienCreada, setRecienCreada] = useState<string | null>(null);

  const { recargar: recargarPersonas } = personas;
  const repartir = useCallback(
    async (accion: () => Promise<unknown>) => {
      setGuardando(true);
      setRechazo(null);
      try {
        await accion();
        // Lo que quedó lo dice el servidor. El `PUT` devuelve el usuario ya
        // actualizado, pero acá cambia una lista entera —quién entra a este
        // tambo— y esa la arma la respuesta completa, no una fila.
        recargarPersonas();
      } catch (causa) {
        setRechazo(mensajeDe(causa));
      } finally {
        setGuardando(false);
      }
    },
    [recargarPersonas],
  );

  const titulo = tambo.datos?.nombre ?? 'El tambo';

  if (personas.cargando && personas.datos === null) {
    return (
      <Armazon titulo={titulo} volverA={aPanelTambo(id)}>
        <Cargando que="Buscando a la gente…" />
      </Armazon>
    );
  }

  if (personas.error !== null || personas.datos === null) {
    return (
      <Armazon titulo={titulo} volverA={aPanelTambo(id)}>
        <TarjetaCaida titulo="Quién entra" error={personas.error} reintentar={personas.recargar} />
      </Armazon>
    );
  }

  const gente = personas.datos.usuarios;

  return (
    <Armazon titulo={titulo} volverA={aPanelTambo(id)}>
      {rechazo !== null && <Aviso titulo="No se pudo guardar">{rechazo}</Aviso>}

      <Reparto
        est={id}
        personas={gente}
        tambos={tambos.datos?.establecimientos ?? null}
        guardando={guardando}
        repartir={repartir}
        alCambiar={personas.recargar}
      />

      <RepartoAjeno personas={gente} />

      <DarAcceso
        est={id}
        personas={gente}
        guardando={guardando}
        repartir={repartir}
        elegida={recienCreada}
      />

      <AltaDePersona
        alCrear={(nueva) => {
          setRecienCreada(nueva);
          personas.recargar();
        }}
      />
    </Armazon>
  );
}

/** ¿Esta persona tiene permiso propio sobre este tambo? */
const permisoEn = (usuario: UsuarioAdmin, est: string): Rol | null =>
  usuario.permisos.find((p) => p.establecimiento_id === est)?.rol ?? null;

type Repartir = (accion: () => Promise<unknown>) => Promise<void>;

function Reparto({
  est,
  personas,
  tambos,
  guardando,
  repartir,
  alCambiar,
}: {
  est: string;
  personas: UsuarioAdmin[];
  tambos: EstablecimientoDeLaLista[] | null;
  guardando: boolean;
  repartir: Repartir;
  alCambiar: () => void;
}) {
  const conPermiso = personas.filter((u) => permisoEn(u, est) !== null);

  return (
    <Tarjeta
      titulo="Quién entra a este tambo"
      subtitulo="Sacar o cambiar un permiso tiene efecto en el pedido siguiente."
    >
      {conPermiso.length === 0 ? (
        <p className="vacio">
          Nadie tiene permiso sobre este tambo todavía. Dáselo abajo a quien lo vaya a usar.
        </p>
      ) : (
        <ul className="lista-simple">
          {conPermiso.map((persona) => {
            const rol = permisoEn(persona, est) as Rol;
            const elOtro: Rol = rol === 'escritura' ? 'lectura' : 'escritura';
            return (
              <FichaDePersona
                key={persona.id}
                persona={persona}
                tambos={tambos}
                alCambiar={alCambiar}
              >
                {/* El permiso sobre **este** tambo, que es lo que se viene a
                    hacer acá. El cambio es un toque porque son dos roles: el
                    botón ofrece el otro. No hace falta revocar antes —el `PUT`
                    cambia en su lugar— y revocar abriría un hueco en el medio. */}
                <div className="etiquetas">
                  <span className={`etiqueta ${rol === 'escritura' ? 'verde' : 'gris'}`}>{rol}</span>
                </div>
                <div className="acciones">
                  <button
                    className="boton chico secundario"
                    type="button"
                    disabled={guardando}
                    onClick={() => void repartir(() => api.otorgarPermiso(persona.id, est, elOtro))}
                  >
                    Pasar a {elOtro}
                  </button>
                  <button
                    className="boton chico secundario"
                    type="button"
                    disabled={guardando}
                    onClick={() => void repartir(() => api.revocarPermiso(persona.id, est))}
                  >
                    Sacar el acceso
                  </button>
                </div>
              </FichaDePersona>
            );
          })}
        </ul>
      )}
    </Tarjeta>
  );
}

/**
 * Los administradores, que entran a este tambo **sin figurar en su reparto**.
 *
 * Un admin viene con `permisos: []` a propósito —puede todo en todos lados, así
 * que no necesita que le den permiso sobre ninguno—, y entonces el filtro de
 * arriba no lo devuelve nunca. Una pantalla que diga "quién entra a este tambo"
 * y omita a las personas que entran a todos **está mintiendo**, y es la clase de
 * mentira que se descubre el día que alguien pregunta quién tocó qué.
 *
 * Van aparte y no mezclados con el reparto porque acá no hay nada que repartir:
 * su acceso no sale de este tambo y no se les puede sacar desde esta pantalla.
 */
function RepartoAjeno({ personas }: { personas: UsuarioAdmin[] }) {
  const admins = personas.filter((u) => u.es_admin);
  if (admins.length === 0) return null;

  return (
    <Tarjeta titulo="Y además, los administradores">
      <p className="vacio">
        Entran a todos los tambos sin figurar en el reparto de ninguno. Para sacarle el acceso a
        uno hay que dejar de hacerlo administrador, en Todas las personas.
      </p>
      <ul className="lista-simple">
        {admins.map((admin) => (
          <li key={admin.id}>
            <div className="etiquetas">
              <strong>{admin.nombre}</strong>
              <span className="etiqueta ambar">administrador</span>
              {!admin.activo && <span className="etiqueta rojo">desactivado</span>}
            </div>
            <span className="renglon">{admin.email}</span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}

/**
 * Darle acceso a alguien que ya existe.
 *
 * No hace falta otro pedido para armar esta lista: `GET /usuarios` trae a todo
 * el sistema, así que los candidatos son los que ya vinieron menos los que ya
 * entran. Y si la persona no existe, el alta está justo abajo — de ahí vuelve
 * ya elegida acá, que es lo que uno iba a hacer a continuación.
 */
function DarAcceso({
  est,
  personas,
  guardando,
  repartir,
  elegida,
}: {
  est: string;
  personas: UsuarioAdmin[];
  guardando: boolean;
  repartir: Repartir;
  elegida: string | null;
}) {
  const [quien, setQuien] = useState('');
  const [rol, setRol] = useState<Rol>('escritura');

  // Los admins no están: ya entran, y "darles permiso" no cambiaría nada.
  const candidatos = personas.filter((u) => !u.es_admin && permisoEn(u, est) === null);
  const seleccionada = quien !== '' ? quien : (elegida ?? '');

  if (candidatos.length === 0) {
    return (
      <Tarjeta titulo="Dar acceso">
        <p className="vacio">
          Todas las personas que hay ya entran a este tambo. Si falta alguien, creala acá abajo.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Dar acceso">
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void repartir(() => api.otorgarPermiso(seleccionada, est, rol)).then(() => setQuien(''));
        }}
      >
        <Campo etiqueta="Quién">
          <select value={seleccionada} onChange={(e) => setQuien(e.target.value)} required>
            <option value="">Elegí a alguien…</option>
            {candidatos.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.nombre} — {persona.email}
                {persona.activo ? '' : ' (desactivado)'}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Con qué permiso"
          ayuda="Escritura carga eventos, altas y tanque. Lectura solamente mira."
        >
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            <option value="escritura">escritura</option>
            <option value="lectura">lectura</option>
          </select>
        </Campo>

        <button className="boton ancho" type="submit" disabled={guardando || seleccionada === ''}>
          {guardando ? 'Dando acceso…' : 'Dar el acceso'}
        </button>
      </form>
    </Tarjeta>
  );
}
