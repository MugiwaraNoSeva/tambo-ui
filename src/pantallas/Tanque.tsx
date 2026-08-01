// ─────────────────────────────────────────────────────────────────────────────
// El tanque: cargar los litros del día y ver el período.
//
// A diferencia del tablero —que pregunta sin período porque todavía no sabe qué
// día es (decisión 56)— acá el período **sí** viene acotado, y por eso aparece
// `dias_sin_registro`: sin bordes la API no puede decir qué días faltan
// (decisión 49). El período por default es **el mes en curso**, que es como se
// paga la leche y por lo tanto como se la mira.
//
// El default se arma cortando el string del día del servidor (`2026-07-29` →
// `2026-07-01`), sin una sola cuenta de fechas: la decisión 52 prohibe `new
// Date` acá adentro, y un `slice` no tiene zona horaria.
//
// Y no hay "Confirmar igual" en esta pantalla: `POST /tanque` no acepta un campo
// `forzado` en su cuerpo (§9), así que ofrecerlo sería un botón que la API no
// puede cumplir. Por eso el `Rechazo` va sin `alConfirmar`.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState, type FormEvent } from 'react';
import { ErrorApi, api } from '../api/cliente';
import type { CuerpoError, CuerpoTanque } from '../api/tipos';
import { Armazon } from '../componentes/armazon';
import { Aviso, Cargando, Cifra, SoloLectura, Tarjeta } from '../componentes/basicos';
import { Campo, CampoFecha, Rechazo } from '../componentes/formulario';
import { usarEstablecimiento } from '../establecimiento';
import { fechaCorta, litros as enLitros, numero } from '../formato';
import { hoyDelServidor } from '../reloj';
import { aTablero } from '../ruteo';
import { mensajeDe, usarPedido } from '../usarPedido';

/** `2026-07-29` → `2026-07-01`. Presentación pura: corta, no calcula. */
const primeroDelMes = (dia: string): string => `${dia.slice(0, 8)}01`;

/**
 * Cuántas fechas faltantes se escriben antes de resumir. Ocho entran en dos
 * renglones de celular; de ahí en más la lista deja de ser una lista de tareas y
 * pasa a ser un párrafo (decisión 65).
 */
const DIAS_QUE_SE_LISTAN = 8;

export function Tanque() {
  const { id: est, puedeCargar } = usarEstablecimiento();
  const hoy = hoyDelServidor();

  const [desde, setDesde] = useState(() => primeroDelMes(hoy));
  const [hasta, setHasta] = useState(hoy);
  const [version, setVersion] = useState(0);

  // `version` no se usa adentro y por eso está: cambiarla es lo que vuelve a
  // pedir el período después de cargar un registro. Los totales los calcula el
  // servidor y la UI no los puede adivinar (por eso no hay caché optimista).
  const traer = useCallback(() => api.tanque(est, { desde, hasta }), [est, desde, hasta, version]);
  const { datos, cargando, error, recargar } = usarPedido(traer);

  return (
    <Armazon titulo="El tanque" volverA={aTablero()}>
      {/* El período se mira igual con cualquier permiso: es una lectura. Lo que
          cambia es la tarjeta de arriba, que es la que escribe. */}
      {puedeCargar ? (
        <CargaDelDia hoy={hoy} alCargar={() => setVersion((n) => n + 1)} />
      ) : (
        <SoloLectura>No podés cargar el tanque en este tambo.</SoloLectura>
      )}

      <Tarjeta titulo="El período">
        <div className="dos-columnas">
          <Campo etiqueta="Desde">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta">
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
        </div>

        {cargando && <Cargando que="Sumando el período…" />}
        {!cargando && (error !== null || datos === null) && (
          <>
            <Aviso titulo="No se pudo traer el período">
              {error ?? 'El servidor no contestó.'}
            </Aviso>
            <button className="boton ancho secundario" type="button" onClick={recargar}>
              Reintentar
            </button>
          </>
        )}

        {!cargando && datos !== null && error === null && (
          <>
            <div className="cifras">
              <Cifra rotulo="Litros del período" valor={enLitros(datos.litros_totales, 0)} />
              <Cifra rotulo="Promedio por día" valor={enLitros(datos.promedio_diario)} />
              <Cifra
                rotulo="Por vaca en ordeñe hoy"
                valor={enLitros(datos.litros_por_vaca_en_ordene)}
              />
              <Cifra rotulo="Días cargados" valor={numero(datos.registros.length)} />
              <Cifra rotulo="Días sin cargar" valor={numero(datos.dias_sin_registro?.length)} />
            </div>

            {/* El hueco silencioso que la decisión 33 vino a mostrar: un día sin
                cargar no baja el promedio —que divide por días con registro—,
                desaparece de la cuenta del mes. La cuenta va arriba como cifra y
                acá van las fechas, **acotadas**: la auditoría de cierre encontró
                un período con veinte días seguidos sin cargar, y veinte fechas
                en fila son una pared que nadie lee (decisión 65). */}
            {datos.dias_sin_registro !== null && datos.dias_sin_registro.length > 0 && (
              <Aviso
                tono="atencion"
                titulo={`${numero(datos.dias_sin_registro.length)} ${
                  datos.dias_sin_registro.length === 1 ? 'día' : 'días'
                } sin cargar en este período`}
              >
                {datos.dias_sin_registro.slice(0, DIAS_QUE_SE_LISTAN).map(fechaCorta).join(' · ')}
                {datos.dias_sin_registro.length > DIAS_QUE_SE_LISTAN &&
                  ` y ${numero(datos.dias_sin_registro.length - DIAS_QUE_SE_LISTAN)} más.`}
              </Aviso>
            )}

            {datos.registros.length === 0 ? (
              <p className="vacio">No hay ningún registro en este período.</p>
            ) : (
              <ul className="reparto">
                {[...datos.registros].reverse().map((r) => (
                  <li key={`${r.fecha}-${r.lote ?? 'tambo'}`}>
                    <span>
                      {fechaCorta(r.fecha)}
                      {r.lote !== null && r.lote !== undefined && ` — lote ${r.lote}`}
                    </span>
                    <span className="cuenta">{enLitros(r.litros, 0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Tarjeta>
    </Armazon>
  );
}

function CargaDelDia({ hoy, alCargar }: { hoy: string; alCargar: () => void }) {
  const { id: est } = usarEstablecimiento();

  const [fecha, setFecha] = useState(hoy);
  const [litros, setLitros] = useState('');
  const [lote, setLote] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [rechazo, setRechazo] = useState<CuerpoError | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);

  async function mandar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setRechazo(null);
    setGuardado(null);
    const cuerpo: CuerpoTanque = {
      fecha,
      litros: Number(litros),
      ...(lote.trim() === '' ? {} : { lote: lote.trim() }),
    };
    try {
      const r = await api.cargarTanque(est, cuerpo);
      setGuardado(`Quedaron cargados ${enLitros(r.litros, 0)} del ${fechaCorta(r.fecha)}.`);
      setLitros('');
      setLote('');
      alCargar();
    } catch (causa) {
      setRechazo(
        causa instanceof ErrorApi
          ? causa.cuerpo
          : { codigo: 'SIN_RESPUESTA', mensaje: mensajeDe(causa) },
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta titulo="Cargar el tanque" subtitulo="Por default, los litros de hoy.">
      <form onSubmit={mandar}>
        {/* Con "ayer" a un toque, que en el tanque es el caso más frecuente
            después de hoy: el ordeñe de anoche se carga a la mañana. */}
        <CampoFecha etiqueta="Fecha" valor={fecha} alCambiar={setFecha} hoy={hoy} />
        <Campo etiqueta="Litros">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
            required
          />
        </Campo>
        <Campo
          etiqueta="Lote"
          ayuda="Vacío es el tambo entero, que es lo que suman los totales."
        >
          <input value={lote} onChange={(e) => setLote(e.target.value)} autoComplete="off" />
        </Campo>

        {guardado !== null && (
          <Aviso tono="bien" titulo="Cargado">
            {guardado}
          </Aviso>
        )}
        {/* Sin `alConfirmar`: el cuerpo de `POST /tanque` no lleva `forzado`. */}
        {rechazo !== null && <Rechazo error={rechazo} />}

        <button className="boton ancho" type="submit" disabled={enviando}>
          {enviando ? 'Cargando…' : 'Cargar'}
        </button>
      </form>
    </Tarjeta>
  );
}
