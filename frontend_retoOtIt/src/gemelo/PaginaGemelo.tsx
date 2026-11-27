import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from '../panel/MarcoPanel'
import { fechaHora } from '../panel/tiempo'
import type {
  PuntoHistorial,
  ResultadoCambios,
  ResultadoHistorial,
  ResultadoLecturas,
} from './apiLecturas'
import {
  colorTorreta,
  compararTorreta,
  estadoEnlace,
  piezasNuevas,
  resumirLecturas,
  type Contadores,
  type Enlace,
  type LecturasCelda,
} from './enVivo'
import {
  crearGemelo,
  meterPiezas,
  ponerPasoInicial,
  recibirNodoReal,
  recibirPasosReales,
  ponerModo,
  ponerTorreta,
  ponerVelocidad,
  tomarInstantanea,
  type Instantanea,
  type Modo,
} from './gemelo'
import { ESTACIONES, ESTADOS_TORRETA, NODOS, NODOS_EMPUJADOR } from './nodos'
import {
  CLAVES_PASOS,
  ENTRADAS,
  SALIDAS,
  type FilaSenal,
  type Tono,
} from './senales'
import { NODOS_GARRA } from './garraReal'
import { NOMBRES_VISTAS, type Vista } from './vistas'

// three.js solo se descarga al abrir esta pantalla
const VistaCelda = lazy(() => import('./VistaCelda'))

type Props = {
  obtenerLecturas: () => Promise<ResultadoLecturas>
  obtenerHistorial: (
    plc: string,
    variable: string,
    desde: Date,
    hasta: Date,
  ) => Promise<ResultadoHistorial>
  obtenerCambios: (
    plc: string,
    nodos: readonly string[],
    desde: Date,
  ) => Promise<ResultadoCambios>
  sesionCaducada: () => void
}

// Los cambios de TAB_PASO se piden desde el último que llegó (la primera vez, los más
// recientes que haya, sean de cuando sean). Así no importa si el reloj del colector y el
// del navegador no coinciden. hasta queda lejos en el futuro por la misma razón.
const INICIO_HISTORIAL = new Date(0)
const DIAS_ADELANTO = 365
// Si en este tiempo no llegó ningún cambio de paso, se avisa que la celda está quieta.
export const SEGUNDOS_PASO_QUIETO = 60

type Consulta = {
  enlace: Enlace
  lecturas: LecturasCelda | null
}

// La celda no cambió de paso en un rato: ts del último cambio que hay en el historian
// (null si no hay ninguno). undefined = sí se está moviendo, o aún no se sabe.
type PasoQuieto = { ultimo: string | null } | undefined

// Cada cuántos segundos se piden las lecturas más recientes y, si no hay /lecturas/cambios,
// el historial de cada nodo.
const SEGUNDOS_LECTURAS = 5
const SEGUNDOS_HISTORIAL = 2

// Los nodos que se repiten en el gemelo, agrupados por estación: una consulta por estación.
type Grupo = { plc: string; nodos: string[] }
const GRUPOS: Grupo[] = [
  {
    plc: NODOS.paso.plc,
    nodos: [
      NODOS.paso.nodo,
      ...Object.values(NODOS_EMPUJADOR).map((n) => n.nodo),
    ],
  },
  { plc: 'S7-300', nodos: Object.values(NODOS_GARRA).map((n) => n.nodo) },
]

const MODOS: Modo[] = ['vivo', 'simulacion']

const ENLACES: Record<Enlace, string> = {
  conectando: 'border-linea text-suave',
  en_vivo: 'border-ok/50 bg-ok/10 text-ok',
  atrasado: 'border-alerta/50 bg-alerta/10 text-alerta',
  sin_lecturas: 'border-linea text-suave',
  sin_conexion: 'border-alerta/50 bg-alerta/10 text-alerta',
}

const FOCO: Record<Tono, string> = {
  ok: 'bg-ok',
  acento: 'bg-acento',
  aviso: 'bg-[#f2b233]',
  alerta: 'bg-alerta',
}

// Lo que pasa en cada paso, dicho sin tecnicismos: del 1 al 4 los pistones, 5 y 6 la garra.
const FRASES_PASO = [
  'alimentar',
  'identificar',
  'marcar',
  'soltar',
  'tomar',
  'clasificar',
] as const

const MATERIAL = { al: 'al', pl: 'pl', '': 'ninguna' } as const

type Torreta = 'verde' | 'amarilla' | 'roja'
const TORRETAS: Torreta[] = ['verde', 'amarilla', 'roja']

const AVISO =
  'rounded-md border border-alerta/50 bg-alerta/10 px-2.5 py-1.5 text-[12px] leading-snug text-alerta'

function textoTorreta(valor: number | null, t: TFunction): string {
  const color = colorTorreta(valor)
  if (color === null) return t('gemelo.lecturas.sinDato')
  if (color === 'otro') return t('gemelo.lecturas.torretaOtro', { valor })
  return t(`gemelo.lecturas.torreta_${color}`)
}

const CHIP =
  'rounded-md border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
const PANEL = `${TARJETA} mt-3 flex flex-col gap-4 p-4 lg:absolute lg:mt-0 lg:bg-panel/90 lg:backdrop-blur`
const SUBTITULO =
  'mb-2 text-[12px] font-bold tracking-wide text-suave uppercase'

// Lo que hacen ahora los dos procesos. Pueden ir al mismo tiempo: los pistones preparan
// la siguiente pieza mientras la garra clasifica la anterior.
function frase(
  i: Instantanea,
  modo: Modo,
  enlace: Enlace,
  t: TFunction,
): string {
  const partes: string[] = []
  const pistones = FRASES_PASO[i.paso - 1]
  const garra = FRASES_PASO[i.pasoGarra - 1]
  if (pistones) partes.push(t(`gemelo.frases.${pistones}`))
  if (garra) partes.push(t(`gemelo.frases.${garra}`))
  if (partes.length === 0 && i.empacando)
    partes.push(t('gemelo.frases.empacando'))
  if (partes.length > 0) return partes.join(' ')
  if (i.marcha) return t('gemelo.frases.esperandoPieza')
  if (i.torreta === ESTADOS_TORRETA.amarilla)
    return t('gemelo.frases.mantenimiento')
  if (i.torreta === ESTADOS_TORRETA.reset) return t('gemelo.frases.reset')
  if (modo === 'simulacion') return t('gemelo.frases.paroSimulacion')
  if (enlace === 'en_vivo' || enlace === 'atrasado')
    return t('gemelo.frases.paroTorreta')
  return t('gemelo.frases.sinLecturas')
}

function chipTorreta(i: Instantanea, t: TFunction) {
  const aviso = 'border-aviso/50 bg-aviso/10 text-aviso'
  switch (i.torreta) {
    case ESTADOS_TORRETA.verde:
      return {
        texto: t('gemelo.estadoCelda.marcha'),
        clases: 'border-ok/50 bg-ok/10 text-ok',
      }
    case ESTADOS_TORRETA.amarilla:
      return { texto: t('gemelo.estadoCelda.mantenimiento'), clases: aviso }
    case ESTADOS_TORRETA.reset:
      return { texto: t('gemelo.estadoCelda.reset'), clases: aviso }
    case ESTADOS_TORRETA.roja:
      return {
        texto: t('gemelo.estadoCelda.paro'),
        clases: 'border-alerta/50 bg-alerta/10 text-alerta',
      }
    default:
      return {
        texto: t('gemelo.estadoCelda.sinDato'),
        clases: 'border-linea text-suave',
      }
  }
}

function chipGarra(i: Instantanea, t: TFunction) {
  return i.pasoGarra > 0
    ? {
        texto: t('gemelo.estadoCelda.garraTrabajando'),
        clases: 'border-acento/50 bg-acento/10 text-acento',
      }
    : {
        texto: t('gemelo.estadoCelda.garraEspera'),
        clases: 'border-linea text-suave',
      }
}

function ListaSenales({
  titulo,
  filas,
  i,
}: {
  titulo: string
  filas: FilaSenal[]
  i: Instantanea
}) {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className={SUBTITULO}>{titulo}</h2>
      <ul className="flex flex-col gap-1">
        {filas.map(({ clave, tono }) => (
          <li key={clave} className="flex items-center gap-2 text-[12.5px]">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${i[clave] ? FOCO[tono] : 'bg-suave/35'}`}
            />
            <span className="flex-1">{t(`gemelo.senales.${clave}`)}</span>
            <span className="sr-only">
              {i[clave] ? t('gemelo.encendida') : t('gemelo.apagada')}
            </span>
            <span className="text-[11px] text-suave">{clave}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Valores({
  titulo,
  valores,
}: {
  titulo: string
  valores: [nombre: string, valor: string][]
}) {
  return (
    <div>
      <h2 className={SUBTITULO}>{titulo}</h2>
      <dl className="flex flex-col gap-1">
        {valores.map(([nombre, valor]) => (
          <div
            key={nombre}
            className="flex items-baseline justify-between gap-3 text-[12.5px]"
          >
            <dt className="text-suave">{nombre}</dt>
            <dd className="font-bold tabular-nums">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// Lo que manda la celda real. Es de solo lectura: desde aquí no se le ordena nada.
function LecturasReales({
  consulta,
  pasoQuieto,
}: {
  consulta: Consulta
  pasoQuieto: PasoQuieto
}) {
  const { t } = useTranslation()
  const { lecturas } = consulta

  if (!lecturas || lecturas.ultima === null) {
    return (
      <div>
        <h2 className={SUBTITULO}>{t('gemelo.lecturas.titulo')}</h2>
        <p className="text-[12.5px] leading-snug text-suave">
          {consulta.enlace === 'sin_conexion'
            ? t('gemelo.lecturas.sinConexion')
            : t('gemelo.lecturas.sinLectura')}
        </p>
      </div>
    )
  }
  const sinDato = t('gemelo.lecturas.sinDato')
  const comparacion = compararTorreta(lecturas)
  return (
    <>
      <Valores
        titulo={t('gemelo.lecturas.titulo')}
        valores={[
          [t('gemelo.lecturas.torreta'), textoTorreta(lecturas.torreta, t)],
          [
            t('gemelo.lecturas.torretaReal'),
            lecturas.torretaReal === null
              ? t('gemelo.lecturas.torretaRealPendiente')
              : textoTorreta(lecturas.torretaReal, t),
          ],
          [
            t('gemelo.lecturas.piezasAluminio'),
            lecturas.piezasAluminio === null
              ? sinDato
              : String(lecturas.piezasAluminio),
          ],
          [
            t('gemelo.lecturas.piezasOtras'),
            lecturas.piezasOtras === null
              ? sinDato
              : String(lecturas.piezasOtras),
          ],
          [
            t('gemelo.lecturas.paso'),
            lecturas.paso === null
              ? sinDato
              : t('gemelo.lecturas.pasoValor', {
                  paso: lecturas.paso,
                  nombre: t(`gemelo.pasosReales.${lecturas.paso}`, {
                    defaultValue: '—',
                  }),
                }),
          ],
          [
            t('gemelo.lecturas.latido'),
            lecturas.latido === null ? sinDato : String(lecturas.latido),
          ],
        ]}
      />
      {pasoQuieto && (
        <p role="status" className={AVISO}>
          {pasoQuieto.ultimo
            ? t('gemelo.lecturas.pasoQuieto', {
                fecha: fechaHora(pasoQuieto.ultimo),
              })
            : t('gemelo.lecturas.pasoSinRegistros')}
        </p>
      )}
      {comparacion === 'luces' && (
        <p role="alert" className={AVISO}>
          {t('gemelo.lecturas.alertaLuces')}
        </p>
      )}
      {comparacion === 'distinta' && (
        <p role="alert" className={AVISO}>
          {t('gemelo.lecturas.alertaDistinta', {
            real: textoTorreta(lecturas.torretaReal, t),
            tablero: textoTorreta(lecturas.torreta, t),
          })}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {ESTACIONES.map((estacion) => {
          const nodos = lecturas.estaciones[estacion]
          return (
            <details key={estacion} className="text-[12.5px]">
              <summary className="cursor-pointer text-suave">
                {t(`gemelo.lecturas.estaciones.${estacion}`)} ·{' '}
                {t('gemelo.lecturas.nodos', { count: nodos.length })}
              </summary>
              <dl className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto pl-2">
                {nodos.map(({ nodo, valor }) => (
                  <div key={nodo} className="flex justify-between gap-3">
                    <dt className="truncate text-suave">{nodo}</dt>
                    <dd className="font-bold tabular-nums">{valor}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )
        })}
      </div>
      <p className="text-[12px] leading-snug text-suave">
        {t('gemelo.lecturas.ultima', { fecha: fechaHora(lecturas.ultima) })}
      </p>
      <p className="text-[11px] leading-snug text-suave">
        {t('gemelo.lecturas.nodoTorreta', {
          nodo: NODOS.torreta.nodo,
          ...ESTADOS_TORRETA,
        })}
      </p>
    </>
  )
}

export default function PaginaGemelo({
  obtenerLecturas,
  obtenerHistorial,
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
  const [pasoQuieto, setPasoQuieto] = useState<PasoQuieto>(undefined)
  const [vista, setVista] = useState<Vista>('General')
  const [conEtiquetas, setConEtiquetas] = useState(true)
  const [velocidad, setVelocidad] = useState(1)
  const [torretaSimulada, setTorretaSimulada] = useState<Torreta>('verde')
  const marco = useRef<HTMLDivElement>(null)

  // En vivo: las lecturas más recientes (torreta, contadores, nodos de cada estación) cada
  // 5 s, y los cambios del paso, del empujador y de la garra cada segundo, para repetirlos
  // en orden casi al mismo tiempo que la celda.
  useEffect(() => {
    if (modo !== 'vivo') return
    let vigente = true
    let contadores: Contadores | null = null
    let ultimoPaso: string | null = null // ts del último TAB_PASO recibido
    let cambioLocal = Date.now() // hora del navegador del último cambio nuevo
    let quieto: string | null | undefined = undefined
    let vuelta = 0
    // /lecturas/cambios trae los de una estación en una sola consulta; si no responde
    // (un backend sin ese endpoint), se sigue con /historial nodo por nodo
    let usarCambios = true
    let fallos = 0
    const desdeNodo: Record<string, string> = {} // último ts recibido de cada nodo
    const desdeGrupo: Record<string, string> = {} // y de cada estación
    const pidiendo: Record<string, boolean> = {}

    const recibir = (nodo: string, puntos: PuntoHistorial[]) => {
      if (puntos.length) {
        const ts = puntos[puntos.length - 1].ts
        desdeNodo[nodo] = ts
        const plc = GRUPOS.find((g) => g.nodos.includes(nodo))?.plc
        if (plc && (!desdeGrupo[plc] || ts > desdeGrupo[plc]))
          desdeGrupo[plc] = ts
      }
      if (nodo !== NODOS.paso.nodo) {
        recibirNodoReal(gemelo, nodo, puntos)
        return
      }
      const nuevos = puntos.filter(
        (p) => ultimoPaso === null || Date.parse(p.ts) > Date.parse(ultimoPaso),
      )
      if (nuevos.length && ultimoPaso !== null) cambioLocal = Date.now()
      if (nuevos.length) ultimoPaso = nuevos[nuevos.length - 1].ts
      recibirPasosReales(gemelo, puntos)
    }

    const porHistorial = (grupo: Grupo) => {
      const hasta = new Date(Date.now() + DIAS_ADELANTO * 24 * 3600 * 1000)
      for (const nodo of grupo.nodos) {
        const desde = desdeNodo[nodo]
          ? new Date(desdeNodo[nodo])
          : INICIO_HISTORIAL
        obtenerHistorial(grupo.plc, nodo, desde, hasta).then((resultado) => {
          if (vigente && resultado.ok) recibir(nodo, resultado.puntos)
        })
      }
    }

    const porCambios = (grupo: Grupo) => {
      if (pidiendo[grupo.plc]) return
      pidiendo[grupo.plc] = true
      obtenerCambios(
        grupo.plc,
        grupo.nodos,
        new Date(desdeGrupo[grupo.plc]),
      ).then((resultado) => {
        pidiendo[grupo.plc] = false
        if (!vigente) return
        if (!resultado.ok) {
          if (resultado.motivo === 'sesion') sesionCaducada()
          else if (++fallos >= 3) usarCambios = false
          return
        }
        fallos = 0
        const porNodo: Record<string, PuntoHistorial[]> = {}
        for (const { nodo, ts, valor } of resultado.cambios)
          (porNodo[nodo] ??= []).push({ ts, valor })
        for (const [nodo, puntos] of Object.entries(porNodo))
          recibir(nodo, puntos)
        // venía recortado: se pide lo que sigue sin esperar
        if (resultado.truncado) porCambios(grupo)
      })
    }

    const consultar = () =>
      obtenerLecturas().then((resultado) => {
        if (!vigente) return
        if (!resultado.ok) {
          if (resultado.motivo === 'sesion') sesionCaducada()
          else setConsulta({ enlace: 'sin_conexion', lecturas: null })
          return
        }
        const ahora = Date.now()
        const lecturas = resumirLecturas(resultado.lecturas)
        // cada pieza que contó el S7-1516 entra al gemelo con su material real
        const conteo = piezasNuevas(contadores, lecturas)
        contadores = conteo.contadores
        meterPiezas(gemelo, conteo.nuevas)
        // mientras el historial no diga nada, al menos se muestra el paso en que está
        ponerPasoInicial(gemelo, lecturas.paso)
        ponerTorreta(gemelo, lecturas.torreta)
        setConsulta({
          enlace: estadoEnlace(lecturas, ahora),
          lecturas,
        })
      })

    const cadaSegundo = () => {
      vuelta++
      if (vuelta % SEGUNDOS_LECTURAS === 0) consultar()
      for (const grupo of GRUPOS) {
        // la primera vez (o sin /lecturas/cambios) se pide por /historial
        if (usarCambios && desdeGrupo[grupo.plc]) porCambios(grupo)
        else if (vuelta % SEGUNDOS_HISTORIAL === 0) porHistorial(grupo)
      }
      const ahoraQuieto =
        Date.now() - cambioLocal >= SEGUNDOS_PASO_QUIETO * 1000
          ? ultimoPaso
          : undefined
      if (ahoraQuieto !== quieto) {
        quieto = ahoraQuieto
        setPasoQuieto(quieto === undefined ? undefined : { ultimo: quieto })
      }
    }
    consultar()
    for (const grupo of GRUPOS) porHistorial(grupo)
    const reloj = setInterval(cadaSegundo, 1000)
    return () => {
      vigente = false
      clearInterval(reloj)
    }
  }, [
    modo,
    gemelo,
    obtenerLecturas,
    obtenerHistorial,
    obtenerCambios,
    sesionCaducada,
  ])

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
    setTorretaSimulada('verde')
    setConsulta({ enlace: 'conectando', lecturas: null })
    setPasoQuieto(undefined)
    setModo(nuevo)
  }

  function cambiarTorreta(torreta: Torreta) {
    ponerTorreta(gemelo, ESTADOS_TORRETA[torreta])
    setTorretaSimulada(torreta)
  }

  const i = instantanea
  const enVivo = modo === 'vivo'
  const torreta = chipTorreta(i, t)
  const garra = chipGarra(i, t)
  const enlace = ENLACES[consulta.enlace]

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
        <span className={`${CHIP} ${torreta.clases}`}>{torreta.texto}</span>
        <span className={`${CHIP} ${garra.clases}`}>{garra.texto}</span>
        <span
          className={`${CHIP} ${enVivo ? enlace : 'border-linea text-suave'}`}
        >
          {enVivo
            ? t(`gemelo.enlaces.${consulta.enlace}`)
            : t('gemelo.datosSimulados')}
        </span>
        <p className="min-w-0 basis-full text-[14px] text-suave xl:basis-auto">
          {frase(i, modo, consulta.enlace, t)}
        </p>
      </div>

      <ol
        aria-label={t('gemelo.secuencia')}
        className={`${TARJETA} flex overflow-x-auto`}
      >
        {CLAVES_PASOS.map((clave, indice) => {
          const activo =
            indice === 6
              ? i.empacando
              : i.paso === indice + 1 || i.pasoGarra === indice + 1
          return (
            <li
              key={clave}
              aria-current={activo ? 'step' : undefined}
              className={`flex shrink-0 items-baseline gap-2 border-b-[3px] px-3.5 py-2.5 text-[12.5px] whitespace-nowrap ${
                activo
                  ? 'border-acento bg-acento/10 font-bold text-texto'
                  : 'border-transparent text-suave'
              }`}
            >
              <span className={activo ? 'text-acento' : undefined}>
                {indice + 1}
              </span>
              {t(`gemelo.pasos.${clave}`)}
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
        </div>

        <section
          data-obstaculo
          aria-label={
            enVivo
              ? t('gemelo.paneles.lecturasVista')
              : t('gemelo.paneles.torretaVista')
          }
          className={`${PANEL} lg:top-3 lg:left-3 lg:w-[236px]`}
        >
          {enVivo ? (
            <LecturasReales consulta={consulta} pasoQuieto={pasoQuieto} />
          ) : (
            <div>
              <h2 className={SUBTITULO}>{t('gemelo.torreta.titulo')}</h2>
              <Segmentos
                etiqueta={t('gemelo.torreta.titulo')}
                opciones={TORRETAS.map((valor) => ({
                  valor,
                  texto: t(`gemelo.torreta.${valor}`),
                }))}
                valor={torretaSimulada}
                alCambiar={cambiarTorreta}
              />
              <p className="mt-2 text-[12px] leading-snug text-suave">
                {t('gemelo.torreta.nota')}
              </p>
            </div>
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
                disabled={modo === 'vivo'}
                onChange={(evento) => {
                  const nueva = Number(evento.target.value)
                  ponerVelocidad(gemelo, nueva)
                  setVelocidad(nueva)
                }}
                className="w-full accent-acento disabled:opacity-40"
              />
            </label>
            {modo === 'vivo' && (
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
          aria-label={t('gemelo.paneles.senales')}
          className={`${PANEL} lg:top-3 lg:right-3 lg:bottom-3 lg:w-[272px] lg:overflow-y-auto`}
        >
          {enVivo && (
            <p className="text-[12px] leading-snug text-suave">
              {t('gemelo.notaEnVivo')}
            </p>
          )}
          <Valores
            titulo={t('gemelo.valores.titulo')}
            valores={[
              [
                t('gemelo.valores.material'),
                t(`gemelo.material.${MATERIAL[i.material]}`),
              ],
              [
                t('gemelo.valores.materialGarra'),
                t(`gemelo.material.${MATERIAL[i.materialGarra]}`),
              ],
              [
                t('gemelo.valores.destinoCarro'),
                i.posX
                  ? t('gemelo.valores.carril', { n: i.posX })
                  : t('gemelo.valores.deposito'),
              ],
              [t('gemelo.valores.posicionCarro'), `${Math.round(i.posMm)} mm`],
              [t('gemelo.valores.piezasAl'), String(i.piezasAl)],
              [t('gemelo.valores.piezasPl'), String(i.piezasPl)],
              [t('gemelo.valores.cajasAl'), String(i.cajasAl)],
              [t('gemelo.valores.cajasPl'), String(i.cajasPl)],
              [t('gemelo.valores.ultimoCiclo'), `${i.tCiclo.toFixed(1)} s`],
              [t('gemelo.valores.presion'), `${i.presion.toFixed(2)} bar`],
            ]}
          />
          <ListaSenales
            titulo={t('gemelo.listas.salidas')}
            filas={SALIDAS}
            i={i}
          />
          <ListaSenales
            titulo={t('gemelo.listas.entradas')}
            filas={ENTRADAS}
            i={i}
          />
        </section>
      </div>
    </MarcoPanel>
  )
}
