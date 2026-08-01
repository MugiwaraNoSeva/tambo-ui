// ─────────────────────────────────────────────────────────────────────────────
// El panel del admin: los tambos, la gente de cada uno, y la puerta para entrar.
//
// Hasta esta tanda, administrar se hacía con `curl` y esta UI lo decía en voz
// alta: *"administrar es trabajo que se hace una vez cada tanto y no le
// corresponde a la pantalla del corral"*. Era cierto y se revisó — el porqué
// está en el README—, así que acá vive lo que antes eran tres comandos.
//
// **Esto no es de un tambo.** Por eso se dibuja afuera del establecimiento
// activo: la lista no pertenece a ninguno, y la gente de uno se mira sin estar
// conectado a él. `App` parte el árbol una sola vez y este archivo es el otro
// lado.
//
// Nada de acá protege nada: la cerradura es el 403 de la API, que estas rutas se
// comen enteras si las pide alguien que no es admin. Lo que hay acá es la
// pantalla que le corresponde al que sí lo es.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import type { Rol, UsuarioAdmin } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Tarjeta, TarjetaCaida } from '../componentes/basicos';
import { Campo } from '../componentes/formulario';
import { aPanel, aPanelTambo, aPanelUsuarios, type Ruta } from '../ruteo';
import { usarSalir, usarUsuario } from '../usuario';
import { mensajeDe, usarPedido } from '../usarPedido';
import { Cuenta } from './Cuenta';
import { Personas } from './Personas';

export function Panel({
  ruta,
  alEntrarAlTambo,
}: {
  ruta: Ruta;
  alEntrarAlTambo: (id: string) => void;
}) {
  switch (ruta.nombre) {
    case 'panel-tambo':
      return <TamboDelPanel id={ruta.id} alEntrarAlTambo={alEntrarAlTambo} />;

    case 'panel-usuarios':
      return <Personas />;

    // "Mi cuenta" es la única pantalla que vive en los dos árboles: la
    // contraseña es de la persona y no del tambo. Y en una base recién instalada
    // es la única forma que tiene el admin de cambiar la suya — el `curl` del
    // despliegue lo manda a hacerlo antes de que exista un solo tambo.
    case 'cuenta':
      return <Cuenta volverA={aPanel()} />;

    // Todo lo demás es la lista, incluido el hash de una pantalla de tambo
    // cuando todavía no hay ninguno abierto (ver `ComoAdmin`).
    default:
      return <ListaDeTambos />;
  }
}

// ── Los tambos ───────────────────────────────────────────────────────────────

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
  const traerTambos = useCallback(() => api.establecimientos(), []);
  const tambos = usarPedido(traerTambos);
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);

  if (tambos.cargando) {
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
      {lista.length === 0 ? (
        <PrimerTambo alCrear={tambos.recargar} nombre={usuario.nombre} />
      ) : (
        <>
          <Tarjeta titulo="Los tambos" subtitulo="Tocá uno para ver quién entra y con qué permiso.">
            <ul className="lista">
              {lista.map((tambo) => (
                <li key={tambo.id}>
                  <a className="fila" href={aPanelTambo(tambo.id)}>
                    <span className="nombre-tambo">{tambo.nombre}</span>
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

      <div className="acciones">
        <a className="boton secundario" href={aPanelUsuarios()}>
          Las personas
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
 * usuario es el admin. Hasta esta tanda, acá se le imprimían tres `curl` y un
 * párrafo explicando que la UI no administraba. Ahora administra: lo que va es
 * el formulario que crea el primer tambo.
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
 * La `Config` no se pide ni se ofrece. La API le pone la del núcleo al crear, y
 * no existe un `PATCH /establecimientos/{est}` que la cambie después — ni por
 * acá ni por `curl`. Un formulario que la ofreciera estaría prometiendo algo que
 * la API no puede cumplir, y se descubriría al querer guardarlo.
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

// ── El tambo por dentro ──────────────────────────────────────────────────────

/**
 * Quién entra a este tambo, con qué permiso, y la puerta para entrar a usarlo.
 *
 * La lista sale de `GET /usuarios` filtrada por `permisos`, y tiene **tres
 * trampas** que la respuesta obvia no ve. Las tres están escritas donde pasan:
 *
 *   1. los administradores no figuran en el reparto de ningún tambo y entran a
 *      todos igual (`RepartoAjeno`);
 *   2. los desactivados sí figuran, y **no entran** (`FilaDePersona`);
 *   3. la misma respuesta trae a todo el sistema, así que dar acceso a alguien
 *      que ya existe no necesita otro pedido (`DarAcceso`).
 */
function TamboDelPanel({
  id,
  alEntrarAlTambo,
}: {
  id: string;
  alEntrarAlTambo: (id: string) => void;
}) {
  const traerTambo = useCallback(() => api.establecimiento(id), [id]);
  const tambo = usarPedido(traerTambo);
  const traerPersonas = useCallback(() => api.usuarios(), []);
  const personas = usarPedido(traerPersonas);
  const [guardando, setGuardando] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);

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

  if (tambo.cargando) {
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

  const nombre = tambo.datos.nombre;

  return (
    <Armazon titulo={nombre} volverA={aPanel()}>
      <Tarjeta titulo="Este tambo">
        <p className="vacio">
          Entrar es usarlo como cualquiera de su gente: cargás, das de alta y anulás, porque sos
          administrador. La vuelta al panel está en el tablero.
        </p>
        <button
          className="boton ancho"
          type="button"
          onClick={() => alEntrarAlTambo(id)}
        >
          Entrar al tambo
        </button>
      </Tarjeta>

      {personas.cargando && <Cargando que="Buscando a la gente…" />}

      {personas.error !== null && (
        <TarjetaCaida titulo="Quién entra" error={personas.error} reintentar={personas.recargar} />
      )}

      {personas.datos !== null && (
        <>
          {rechazo !== null && <Aviso titulo="No se pudo guardar">{rechazo}</Aviso>}

          <Reparto
            est={id}
            personas={personas.datos.usuarios}
            guardando={guardando}
            repartir={repartir}
          />

          <RepartoAjeno personas={personas.datos.usuarios} />

          <DarAcceso
            est={id}
            personas={personas.datos.usuarios}
            guardando={guardando}
            repartir={repartir}
          />
        </>
      )}
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
  guardando,
  repartir,
}: {
  est: string;
  personas: UsuarioAdmin[];
  guardando: boolean;
  repartir: Repartir;
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
          {conPermiso.map((persona) => (
            <FilaDePersona
              key={persona.id}
              persona={persona}
              rol={permisoEn(persona, est) as Rol}
              guardando={guardando}
              alCambiar={(rol) => repartir(() => api.otorgarPermiso(persona.id, est, rol))}
              alSacar={() => repartir(() => api.revocarPermiso(persona.id, est))}
            />
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

/**
 * Una persona con permiso sobre este tambo.
 *
 * **El desactivado se muestra, y se muestra como lo que es.** Su permiso sigue
 * ahí y aun así no entra: esconderlo dejaría al admin sin poder volver a
 * entrarlo, que es lo único que se hace con alguien desactivado, y mostrarlo
 * como a los demás diría que entra alguien que no entra.
 *
 * El cambio de permiso es un toque porque son **dos** roles: el botón ofrece el
 * otro. No hace falta revocar antes —el `PUT` cambia en su lugar—, y revocar
 * antes abriría un hueco en el medio.
 */
function FilaDePersona({
  persona,
  rol,
  guardando,
  alCambiar,
  alSacar,
}: {
  persona: UsuarioAdmin;
  rol: Rol;
  guardando: boolean;
  alCambiar: (rol: Rol) => void;
  alSacar: () => void;
}) {
  const elOtro: Rol = rol === 'escritura' ? 'lectura' : 'escritura';

  return (
    <li>
      <div className="etiquetas">
        <strong>{persona.nombre}</strong>
        <span className={`etiqueta ${rol === 'escritura' ? 'verde' : 'gris'}`}>{rol}</span>
        {!persona.activo && <span className="etiqueta rojo">desactivado</span>}
      </div>
      <span className="renglon">{persona.email}</span>
      {!persona.activo && (
        <span className="renglon aviso-suave">
          No entra: está desactivado. El permiso queda para cuando vuelva.
        </span>
      )}
      <div className="acciones">
        <button
          className="boton chico secundario"
          type="button"
          disabled={guardando}
          onClick={() => alCambiar(elOtro)}
        >
          Pasar a {elOtro}
        </button>
        <button
          className="boton chico secundario"
          type="button"
          disabled={guardando}
          onClick={alSacar}
        >
          Sacar el acceso
        </button>
      </div>
    </li>
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
        uno hay que dejar de hacerlo administrador, en Las personas.
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
 * entran. Crear a alguien nuevo es la otra pantalla, y el enlace está acá porque
 * este es el momento en que uno se entera de que la persona no existe.
 */
function DarAcceso({
  est,
  personas,
  guardando,
  repartir,
}: {
  est: string;
  personas: UsuarioAdmin[];
  guardando: boolean;
  repartir: Repartir;
}) {
  const [quien, setQuien] = useState('');
  const [rol, setRol] = useState<Rol>('escritura');

  // Los admins no están: ya entran, y "darles permiso" no cambiaría nada.
  const candidatos = personas.filter((u) => !u.es_admin && permisoEn(u, est) === null);

  return (
    <Tarjeta titulo="Dar acceso">
      {candidatos.length === 0 ? (
        <p className="vacio">
          Todas las personas que hay ya entran a este tambo. Si falta alguien, primero hay que
          crearla.
        </p>
      ) : (
        <form
          onSubmit={(evento) => {
            evento.preventDefault();
            void repartir(() => api.otorgarPermiso(quien, est, rol)).then(() => setQuien(''));
          }}
        >
          <Campo etiqueta="Quién">
            <select value={quien} onChange={(e) => setQuien(e.target.value)} required>
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

          <button className="boton ancho" type="submit" disabled={guardando || quien === ''}>
            {guardando ? 'Dando acceso…' : 'Dar el acceso'}
          </button>
        </form>
      )}

      <a className="boton ancho secundario" href={aPanelUsuarios()}>
        Crear una persona
      </a>
    </Tarjeta>
  );
}
