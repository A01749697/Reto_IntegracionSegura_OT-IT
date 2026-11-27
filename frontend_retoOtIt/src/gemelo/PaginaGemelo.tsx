import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from '../panel/MarcoPanel'
import { fechaHora } from '../panel/tiempo'
import type { ResultadoCambios, ResultadoLecturas } from './apiLecturas'
import {
  estadoEnlace,
  resumirLecturas,
  type Enlace,
  type LecturasCelda,
} from './enVivo'
import type { EstadoCelda } from './estado'
import {
  crearGemelo,
  mandarSimulacion,
  ponerEnlace,
  ponerModo,
  ponerVelocidad,
  recibirCambiosReales,
  sembrarValores,
  tomarInstantanea,
  type Instantanea,
  type MandoSimulado,
  type Modo,
} from './gemelo'
import {
  ESTACIONES,
  NODO,
  NODOS_TABLERO,
  PASOS,
  PLC_TABLERO,
  type ClaveNodo,
} from './nodos'
import { desdeParaConsulta } from './repeticion'
import { SENALES_GARRA, type Tono } from './senales'
import { NOMBRES_VISTAS, type Vista } from './vistas'

// three.js solo se descarga al abrir esta pantalla
const VistaCelda = lazy(() => import('./VistaCelda'))

type Props = {
  obtenerLecturas: () => Promise<ResultadoLecturas>
  obtenerCambios: (
    plc: string,
    nodos: readonly string[],
    desde: Date,
  ) => Promise<ResultadoCambios>
  sesionCaducada: () => void
}

// En vivo: las lecturas más recientes (enlace y nodos de cada estación) cada 5 s y los
// cambios del S7-1516 cada 2 s. La repetición va unos segundos atrás (ver repeticion.ts).
export const SEGUNDOS_LECTURAS = 5
export const SEGUNDOS_CAMBIOS = 2
// Si /lecturas/cambios no responde en este tiempo, la celda queda sin comunicación.
export const SEGUNDOS_SIN_ENLACE = 6
// Si LATIDO no ha cambiado en este rato, se avisa que no se puede vigilar la comunicación.
const SEGUNDOS_AVISO_LATIDO = 15

type Consulta = { enlace: Enlace; lecturas: LecturasCelda | null }

const MODOS: Modo[] = ['vivo', 'simulacion']

const ENLACES: Record<Enlace, string> = {
  conectando: 'border-linea text-suave',
  en_vivo: 'border-ok/50 bg-ok/10 text-ok',
  atrasado: 'border-alerta/50 bg-alerta/10 text-alerta',
  sin_lecturas: 'border-linea text-suave',
  sin_conexion: 'border-alerta/50 bg-alerta/10 text-alerta',
}

// Color del letrero por estado. El reset parpadea igual que la torreta.
const LETRERO: Record<EstadoCelda, string> = {
  marcha: 'border-ok bg-ok/15 text-ok',
  mantenimiento: 'border-aviso bg-aviso/15 text-aviso',
  reset: 'border-aviso bg-aviso/15 text-aviso motion-safe:animate-pulse',
  paro: 'border-alerta bg-alerta/15 text-alerta',
  falla: 'border-alerta bg-alerta/25 text-alerta',
  sinDato: 'border-suave/60 bg-black/40 text-white/80',
  sinComunicacion: 'border-suave/60 bg-black/50 text-white/80',
}

const FOCO: Record<Tono, string> = {
  ok: 'bg-ok',
  acento: 'bg-acento',
  aviso: 'bg-aviso',
  alerta: 'bg-alerta',
}

const MATERIAL = { al: 'al', pl: 'pl', '': 'ninguna' } as const

const CHIP =
  'rounded-md border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
const PANEL = `${TARJETA} mt-3 flex flex-col gap-4 p-4 lg:absolute lg:mt-0 lg:bg-panel/90 lg:backdrop-blur`
const SUBTITULO =
  'mb-2 text-[12px] font-bold tracking-wide text-suave uppercase'

// Los datos del S7-1516 que se muestran, en orden.
type Formato = 'numero' | 'bool' | 'segundos'
const DATOS = [
  { clave: 'marcha', formato: 'bool' },
  { clave: 'falla', formato: 'bool' },
  { clave: 'codFalla', formato: 'numero' },
  { clave: 'ciclos', formato: 'numero' },
  { clave: 'aluminio', formato: 'numero' },
  { clave: 'otras', formato: 'numero' },
  { clave: 'tCiclo', formato: 'segundos' },
  { clave: 'tCarreraPd1', formato: 'segundos' },
] as const satisfies readonly { clave: ClaveNodo; formato: Formato }[]
const SALIDAS = [
  'empujaExt',
  'empujaRet',
  'aprieta',
  'suelta',
  'sello',
] as const satisfies readonly ClaveNodo[]
const SENSORES = [
  'fincEmpujar',
  'fincApretar',
  'fincSinApretar',
  'fincSello',
  'sensorC',
  'sensorI',
  'esAluminio',
] as const satisfies readonly ClaveNodo[]

function valorDato(
  valor: number | undefined,
  formato: Formato,
  t: TFunction,
): string {
  if (valor === undefined) return t('gemelo.sinDato')
  if (formato === 'bool') return valor === 1 ? t('gemelo.si') : t('gemelo.no')
  if (formato === 'segundos') return `${valor.toFixed(1)} s`
  return String(valor)
}

function Foco({ encendido, tono }: { encendido: boolean; tono: Tono }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${encendido ? FOCO[tono] : 'bg-suave/35'}`}
    />
  )
}

// Una lista de nodos Bool con su foco, su nombre y el nodo.
function ListaNodos({
  titulo,
  filas,
  tono,
  valores,
}: {
  titulo: string
  filas: { clave: ClaveNodo; texto: string }[]
  tono: Tono
  valores: Instantanea['valores']
}) {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className={SUBTITULO}>{titulo}</h2>
      <ul className="flex flex-col gap-1">
        {filas.map(({ clave, texto }) => {
          const encendido = valores[NODO[clave]] === 1
          return (
            <li key={clave} className="flex items-center gap-2 text-[12.5px]">
              <Foco encendido={encendido} tono={tono} />
              <span className="flex-1">{texto}</span>
              <span className="sr-only">
                {encendido ? t('gemelo.encendida') : t('gemelo.apagada')}
              </span>
              <span className="font-mono text-[10.5px] text-suave">
                {NODO[clave]}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Valores({
  titulo,
  valores,
}: {
  titulo: string
  valores: [nombre: string, valor: string, nodo?: string][]
}) {
  return (
    <div>
      <h2 className={SUBTITULO}>{titulo}</h2>
      <dl className="flex flex-col gap-1">
        {valores.map(([nombre, valor, nodo]) => (
          <div
            key={nombre}
            className="flex items-baseline justify-between gap-3 text-[12.5px]"
          >
            <dt className="min-w-0 text-suave">
              {nombre}
              {nodo && (
                <span className="block font-mono text-[10.5px] text-suave/80">
                  {nodo}
                </span>
              )}
            </dt>
            <dd className="font-bold tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function SenalesGarra({ i }: { i: Instantanea }) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-col gap-1">
      {SENALES_GARRA.map(({ clave, tono }) => (
        <li key={clave} className="flex items-center gap-2 text-[12.5px]">
          <Foco encendido={Boolean(i[clave])} tono={tono} />
          <span className="flex-1">{t(`gemelo.senales.${clave}`)}</span>
          <span className="sr-only">
            {i[clave] ? t('gemelo.encendida') : t('gemelo.apagada')}
          </span>
          <span className="text-[11px] text-suave">{clave}</span>
        </li>
      ))}
    </ul>
  )
}

// Lo que llega del historian. De solo lectura: desde aquí no se le ordena nada a la celda.
// Solo cambia con cada consulta: memo evita redibujarlo en cada refresco de la vista.
const Enlace = memo(function Enlace({ consulta }: { consulta: Consulta }) {
  const { t } = useTranslation()
  const { lecturas } = consulta
  if (!lecturas || lecturas.ultima === null) {
    return (
      <div>
        <h2 className={SUBTITULO}>{t('gemelo.enlace.titulo')}</h2>
        <p className="text-[12.5px] leading-snug text-suave">
          {consulta.enlace === 'sin_conexion'
            ? t('gemelo.enlace.sinConexion')
            : consulta.enlace === 'conectando'
              ? t('gemelo.enlaces.conectando')
              : t('gemelo.enlace.sinLecturas')}
        </p>
      </div>
    )
  }
  return (
    <div>
      <h2 className={SUBTITULO}>{t('gemelo.enlace.titulo')}</h2>
      <p className="mb-2 text-[12px] text-suave">
        {t('gemelo.enlace.ultima', { fecha: fechaHora(lecturas.ultima) })}
      </p>
      <div className="flex flex-col gap-1.5">
        {ESTACIONES.map((estacion) => {
          const nodos = lecturas.estaciones[estacion]
          return (
            <details key={estacion} className="text-[12.5px]">
              <summary className="cursor-pointer text-suave">
                {t(`gemelo.enlace.estaciones.${estacion}`)} ·{' '}
                {t('gemelo.enlace.nodos', { count: nodos.length })}
              </summary>
              <dl className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto pl-2">
                {nodos.map(({ nodo, valor }) => (
                  <div key={nodo} className="flex justify-between gap-3">
                    <dt className="truncate font-mono text-[11px] text-suave">
                      {nodo}
                    </dt>
                    <dd className="font-bold tabular-nums">{valor}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )
        })}
      </div>
    </div>
  )
})

// Último registro de LATIDO en el historian, para el aviso cuando no cambia.
function ultimoLatido(lecturas: LecturasCelda | null): string | null {
  const nodo = lecturas?.estaciones['S7-1500'].find(
    (n) => n.nodo === NODO.latido,
  )
  return nodo ? nodo.ts : null
}

const MANDOS: { mando: MandoSimulado; clases: string }[] = [
  { mando: 'marcha', clases: 'border-ok text-ok hover:bg-ok/10' },
  { mando: 'paro', clases: 'border-alerta text-alerta hover:bg-alerta/10' },
  {
    mando: 'mantenimiento',
    clases: 'border-aviso text-aviso hover:bg-aviso/10',
  },
  { mando: 'reset', clases: 'border-linea text-texto hover:border-acento' },
]

const BOTON_MANDO =
  'cursor-pointer rounded-md border-[1.5px] px-2 py-1.5 text-[12.5px] font-bold focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none aria-pressed:bg-current/15'

function Mandos({
  i,
  mantenimiento,
  atasco,
  sinRed,
  mandar,
}: {
  i: Instantanea
  mantenimiento: boolean
  atasco: boolean
  sinRed: boolean
  mandar: (mando: MandoSimulado) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className={SUBTITULO}>{t('gemelo.mandos.titulo')}</h2>
        <div className="grid grid-cols-2 gap-1.5">
          {MANDOS.map(({ mando, clases }) => (
            <button
              key={mando}
              type="button"
              aria-pressed={
                mando === 'mantenimiento' ? mantenimiento : undefined
              }
              onClick={() => mandar(mando)}
              className={`${BOTON_MANDO} ${clases}`}
            >
              {t(`gemelo.mandos.${mando}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h2 className={SUBTITULO}>{t('gemelo.mandos.pruebas')}</h2>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            aria-pressed={atasco}
            onClick={() => mandar('atasco')}
            className={`${BOTON_MANDO} border-linea text-texto hover:border-acento`}
          >
            {t('gemelo.mandos.atasco')}
          </button>
          <button
            type="button"
            aria-pressed={sinRed}
            onClick={() => mandar('comunicacion')}
            className={`${BOTON_MANDO} border-linea text-texto hover:border-acento`}
          >
            {t('gemelo.mandos.comunicacion')}
          </button>
        </div>
        {i.estado === 'falla' && (
          <p className="mt-2 text-[12px] leading-snug text-alerta">
            {t(`gemelo.fallasSimuladas.${i.codFalla}`, {
              defaultValue: t('gemelo.codigoFalla', { codigo: i.codFalla }),
            })}
          </p>
        )}
      </div>
    </div>
  )
}

// En vivo: cuánto va detrás de la celda y si se está vigilando la comunicación con LATIDO.
function AvisosVivo({
  i,
  lecturas,
}: {
  i: Instantanea
  lecturas: LecturasCelda
}) {
  const { t } = useTranslation()
  const latido = ultimoLatido(lecturas)
  const avisarLatido =
    !i.vigilaLatido && i.segundosSinLatido > SEGUNDOS_AVISO_LATIDO
  return (
    <div className="flex flex-col gap-1.5 text-[12px] leading-snug">
      {i.retraso !== null && (
        <p className="text-suave">
          {t('gemelo.enlace.retraso', { segundos: Math.round(i.retraso) })}
        </p>
      )}
      {avisarLatido && (
        <p className="text-alerta">
          {latido
            ? t('gemelo.enlace.latidoQuieto', { fecha: fechaHora(latido) })
            : t('gemelo.enlace.latidoAusente')}
        </p>
      )}
    </div>
  )
}

export default function PaginaGemelo({
  obtenerLecturas,
  obtenerCambios,
  sesionCaducada,
}: Props) {
  const { t, i18n } = useTranslation()
  const [gemelo] = useState(() => crearGemelo('vivo'))
  const [modo, setModo] = useState<Modo>('vivo')
  const [instantanea, setInstantanea] = useState(() => tomarInstantanea(gemelo))
  const [consulta, setConsulta] = useState<Consulta>({
    enlace: 'conectando',
    lecturas: null,
  })
  const [vista, setVista] = useState<Vista>('General')
  const [conEtiquetas, setConEtiquetas] = useState(true)
  const [velocidad, setVelocidad] = useState(1)
  const [pruebas, setPruebas] = useState({
    mantenimiento: false,
    atasco: false,
    sinRed: false,
  })
  const marco = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (modo !== 'vivo') return
    let vigente = true
    let pidiendo = false
    let respondio = Date.now() // última vez que /lecturas/cambios contestó
    const consultarLecturas = () =>
      obtenerLecturas().then((resultado) => {
        if (!vigente) return
        if (!resultado.ok) {
          if (resultado.motivo === 'sesion') sesionCaducada()
          else setConsulta({ enlace: 'sin_conexion', lecturas: null })
          return
        }
        const lecturas = resumirLecturas(resultado.lecturas)
        // la primera vez, el gemelo arranca con lo último que dijo el S7-1516
        if (lecturas.ultimaTablero !== null)
          sembrarValores(gemelo, lecturas.tablero, lecturas.ultimaTablero)
        setConsulta({ enlace: estadoEnlace(lecturas, Date.now()), lecturas })
      })
    // los cambios del S7-1516 desde el último que llegó, para repetirlos en orden
    const consultarCambios = () => {
      // sin respuesta en un rato (red caída o consulta colgada): sin comunicación
      ponerEnlace(gemelo, Date.now() - respondio < SEGUNDOS_SIN_ENLACE * 1000)
      const desde = desdeParaConsulta(gemelo.repeticion)
      if (desde === null || pidiendo) return
      pidiendo = true
      obtenerCambios(PLC_TABLERO, NODOS_TABLERO, desde).then((resultado) => {
        pidiendo = false
        if (!vigente) return
        if (!resultado.ok) {
          if (resultado.motivo === 'sesion') sesionCaducada()
          return
        }
        respondio = Date.now()
        ponerEnlace(gemelo, true)
        recibirCambiosReales(gemelo, resultado.cambios)
        // venía recortado: se pide lo que sigue sin esperar
        if (resultado.truncado) consultarCambios()
      })
    }
    consultarLecturas()
    const lecturas = setInterval(consultarLecturas, SEGUNDOS_LECTURAS * 1000)
    const cambios = setInterval(consultarCambios, SEGUNDOS_CAMBIOS * 1000)
    return () => {
      vigente = false
      clearInterval(lecturas)
      clearInterval(cambios)
    }
  }, [modo, gemelo, obtenerLecturas, obtenerCambios, sesionCaducada])

  const refrescar = useCallback(
    () => setInstantanea(tomarInstantanea(gemelo)),
    [gemelo],
  )
  // los paneles que flotan sobre la vista; las etiquetas no se ponen debajo
  const obstaculos = useCallback(
    () =>
      [...(marco.current?.querySelectorAll('[data-obstaculo]') ?? [])].map(
        (panel) => panel.getBoundingClientRect(),
      ),
    [],
  )

  function cambiarModo(nuevo: Modo) {
    ponerModo(gemelo, nuevo)
    setPruebas({ mantenimiento: false, atasco: false, sinRed: false })
    setConsulta({ enlace: 'conectando', lecturas: null })
    setModo(nuevo)
    refrescar()
  }

  function mandar(mando: MandoSimulado) {
    mandarSimulacion(gemelo, mando)
    setPruebas({
      mantenimiento: gemelo.s7.mantenimiento,
      atasco: gemelo.planta.atasco,
      sinRed: !gemelo.comunicacion,
    })
    refrescar()
  }

  const i = instantanea
  const enVivo = modo === 'vivo'
  const paso = i.pasoReal

  return (
    <MarcoPanel titulo={t('gemelo.titulo')}>
      <div className="flex flex-wrap items-center gap-3">
        <Segmentos
          etiqueta={t('gemelo.fuente')}
          opciones={MODOS.map((valor) => ({
            valor,
            texto: t(`gemelo.modos.${valor}`),
          }))}
          valor={modo}
          alCambiar={cambiarModo}
        />
        <span
          className={`${CHIP} ${enVivo ? ENLACES[consulta.enlace] : 'border-linea text-suave'}`}
        >
          {enVivo
            ? t(`gemelo.enlaces.${consulta.enlace}`)
            : t('gemelo.datosSimulados')}
        </span>
        <span
          className={`${CHIP} ${
            i.pasoGarra > 0
              ? 'border-acento/50 bg-acento/10 text-acento'
              : 'border-linea text-suave'
          }`}
        >
          {i.pasoGarra > 0
            ? t('gemelo.garra.trabajando')
            : t('gemelo.garra.espera')}
        </span>
        {i.empacando && (
          <span className={`${CHIP} border-linea text-suave`}>
            {t('gemelo.empacando')}
          </span>
        )}
      </div>

      <ol
        aria-label={t('gemelo.secuencia')}
        className={`${TARJETA} flex overflow-x-auto`}
      >
        {PASOS.map((n) => {
          const activo = paso === n
          return (
            <li
              key={n}
              aria-current={activo ? 'step' : undefined}
              className={`flex shrink-0 items-baseline gap-2 border-b-[3px] px-3 py-2.5 text-[12.5px] whitespace-nowrap ${
                activo
                  ? 'border-acento bg-acento/10 font-bold text-texto'
                  : 'border-transparent text-suave'
              }`}
            >
              <span className={activo ? 'text-acento' : undefined}>{n}</span>
              {t(`gemelo.pasos.${n}`, { defaultValue: String(n) })}
            </li>
          )
        })}
      </ol>

      <div ref={marco} className="relative">
        <div className="relative h-[62vh] min-h-[380px] overflow-hidden rounded-[10px] border border-linea bg-[#1c252d] lg:h-[calc(100dvh-20rem)] lg:min-h-[640px]">
          <Suspense
            fallback={
              <p className="flex h-full items-center justify-center text-[14px] text-white/70">
                {t('gemelo.cargando3d')}
              </p>
            }
          >
            <VistaCelda
              key={i18n.language}
              gemelo={gemelo}
              vista={vista}
              conEtiquetas={conEtiquetas}
              obstaculos={obstaculos}
              alRefrescar={refrescar}
            />
          </Suspense>
          <div
            data-obstaculo
            role="status"
            aria-label={t('gemelo.letrero')}
            className={`pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md border-2 px-4 py-1.5 text-center font-bold tracking-wider whitespace-nowrap backdrop-blur ${LETRERO[i.estado]}`}
          >
            <span className="text-[15px]">
              {t(`gemelo.estado.${i.estado}`)}
            </span>
            {i.estado === 'falla' && (
              <span className="ml-2 text-[13px]">
                {t('gemelo.codigoFalla', { codigo: i.codFalla })}
              </span>
            )}
          </div>
        </div>

        <section
          data-obstaculo
          aria-label={
            enVivo ? t('gemelo.paneles.enlace') : t('gemelo.paneles.mandos')
          }
          className={`${PANEL} lg:top-3 lg:left-3 lg:w-[236px]`}
        >
          {enVivo ? (
            <Enlace consulta={consulta} />
          ) : (
            <Mandos
              i={i}
              mantenimiento={pruebas.mantenimiento}
              atasco={pruebas.atasco}
              sinRed={pruebas.sinRed}
              mandar={mandar}
            />
          )}
          {enVivo && consulta.lecturas && (
            <AvisosVivo i={i} lecturas={consulta.lecturas} />
          )}

          <div>
            <h2 className={SUBTITULO}>{t('gemelo.vista.titulo')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {NOMBRES_VISTAS.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  aria-pressed={nombre === vista}
                  onClick={() => setVista(nombre)}
                  className={`cursor-pointer rounded-md border px-2 py-1 text-[12px] font-medium focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none ${
                    nombre === vista
                      ? 'border-acento text-acento'
                      : 'border-linea text-suave hover:text-texto'
                  }`}
                >
                  {t(`gemelo.vista.nombres.${nombre}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className={SUBTITULO}>{t('gemelo.ajustes.titulo')}</h2>
            <label className="flex flex-col gap-1 text-[12.5px] text-suave">
              <span className="flex justify-between">
                {t('gemelo.ajustes.velocidad')} <span>{velocidad}x</span>
              </span>
              <input
                type="range"
                min="0.25"
                max="3"
                step="0.25"
                value={velocidad}
                disabled={enVivo}
                onChange={(evento) => {
                  const nueva = Number(evento.target.value)
                  ponerVelocidad(gemelo, nueva)
                  setVelocidad(nueva)
                }}
                className="w-full accent-acento disabled:opacity-40"
              />
            </label>
            {enVivo && (
              <p className="mt-1 text-[11px] leading-snug text-suave">
                {t('gemelo.ajustes.velocidadVivo')}
              </p>
            )}
            <label className="mt-2.5 flex items-center justify-between gap-2 text-[12.5px] text-suave">
              {t('gemelo.ajustes.etiquetas')}
              <input
                type="checkbox"
                checked={conEtiquetas}
                onChange={(evento) => setConEtiquetas(evento.target.checked)}
                className="accent-acento"
              />
            </label>
          </div>
        </section>

        <section
          data-obstaculo
          aria-label={t('gemelo.paneles.datos')}
          className={`${PANEL} lg:top-3 lg:right-3 lg:bottom-3 lg:w-[272px] lg:overflow-y-auto`}
        >
          <Valores
            titulo={t('gemelo.datos.titulo')}
            valores={[
              [
                t('gemelo.datos.paso'),
                paso === null
                  ? t('gemelo.sinDato')
                  : `${paso} · ${t(`gemelo.pasos.${paso}`, { defaultValue: '—' })}`,
                NODO.paso,
              ],
              ...DATOS.map(
                ({ clave, formato }) =>
                  [
                    t(`gemelo.datos.${clave}`),
                    valorDato(i.valores[NODO[clave]], formato, t),
                    NODO[clave],
                  ] as [string, string, string],
              ),
            ]}
          />
          <ListaNodos
            titulo={t('gemelo.salidas.titulo')}
            filas={SALIDAS.map((clave) => ({
              clave,
              texto: t(`gemelo.salidas.${clave}`),
            }))}
            tono="acento"
            valores={i.valores}
          />
          <ListaNodos
            titulo={t('gemelo.sensores.titulo')}
            filas={SENSORES.map((clave) => ({
              clave,
              texto: t(`gemelo.sensores.${clave}`),
            }))}
            tono="ok"
            valores={i.valores}
          />
          <div>
            <Valores
              titulo={t('gemelo.garra.titulo')}
              valores={[
                [
                  t('gemelo.garra.material'),
                  t(`gemelo.material.${MATERIAL[i.materialGarra]}`),
                ],
                [
                  t('gemelo.garra.destino'),
                  i.posX
                    ? t('gemelo.garra.carril', { n: i.posX })
                    : t('gemelo.garra.deposito'),
                ],
                [t('gemelo.garra.piezasAl'), String(i.piezasAl)],
                [t('gemelo.garra.piezasPl'), String(i.piezasPl)],
                [t('gemelo.garra.cajas'), `${i.cajasAl} / ${i.cajasPl}`],
              ]}
            />
            <div className="mt-2">
              <SenalesGarra i={i} />
            </div>
          </div>
        </section>
      </div>
    </MarcoPanel>
  )
}
