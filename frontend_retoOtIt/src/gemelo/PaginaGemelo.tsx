import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { boton, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from '../panel/MarcoPanel'
import { fechaHora } from '../panel/tiempo'
import type { ResultadoLecturas } from './apiLecturas'
import {
  estadoEnlace,
  piezasNuevas,
  resumirLecturas,
  type Enlace,
  type LecturasCelda,
} from './enVivo'
import {
  crearGemelo,
  pedirCiclos,
  ponerModo,
  ponerVelocidad,
  pulsar,
  tomarInstantanea,
  type Instantanea,
  type Mando,
  type Modo,
} from './gemelo'
import {
  CLAVES_PASOS,
  ENTRADAS,
  SALIDAS,
  type FilaSenal,
  type Tono,
} from './senales'
import { NOMBRES_VISTAS, type Vista } from './vistas'

// three.js solo se descarga al abrir esta pantalla
const VistaCelda = lazy(() => import('./VistaCelda'))

type Props = {
  obtenerLecturas: () => Promise<ResultadoLecturas>
  sesionCaducada: () => void
}

type Consulta = { enlace: Enlace; lecturas: LecturasCelda | null }

const SEGUNDOS_ENTRE_CONSULTAS = 5

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

// Lo que pasa en cada paso (del 1 al 6), dicho sin tecnicismos.
const FRASES_PASO = [
  'alimentar',
  'identificar',
  'marcar',
  'toma',
  'tomar',
  'clasificar',
] as const

const MATERIAL = { al: 'al', pl: 'pl', '': 'ninguna' } as const

const CHIP =
  'rounded-md border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap'
const PANEL = `${TARJETA} mt-3 flex flex-col gap-4 p-4 lg:absolute lg:mt-0 lg:bg-panel/90 lg:backdrop-blur`
const SUBTITULO =
  'mb-2 text-[12px] font-bold tracking-wide text-suave uppercase'

function frase(
  i: Instantanea,
  modo: Modo,
  enlace: Enlace,
  t: TFunction,
): string {
  if (i.emergencia) return t('gemelo.frases.emergencia')
  const paso = FRASES_PASO[i.paso - 1]
  if (paso) return t(`gemelo.frases.${paso}`)
  if (i.empacando) return t('gemelo.frases.empacando')
  if (modo === 'simulacion') return t('gemelo.frases.reposoSimulacion')
  if (enlace === 'en_vivo') return t('gemelo.frases.esperando')
  return t('gemelo.frases.sinLecturas')
}

function estadoCelda(i: Instantanea, modo: Modo, t: TFunction) {
  if (i.emergencia)
    return {
      texto: t('gemelo.estadoCelda.emergencia'),
      clases: 'border-alerta bg-alerta text-sobre',
    }
  if (i.paso > 0) {
    const terminando = modo === 'simulacion' && !i.marcha
    return {
      texto: terminando
        ? t('gemelo.estadoCelda.terminando')
        : t('gemelo.estadoCelda.enCiclo'),
      clases: 'border-ok/50 bg-ok/10 text-ok',
    }
  }
  return {
    texto: t('gemelo.estadoCelda.reposo'),
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
function LecturasReales({ consulta }: { consulta: Consulta }) {
  const { t } = useTranslation()
  const { lecturas } = consulta
  const siNo = (valor: number | null, si: string, no: string) =>
    valor === null ? t('gemelo.lecturas.sinDato') : valor !== 0 ? si : no

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
  return (
    <>
      <Valores
        titulo={t('gemelo.lecturas.titulo')}
        valores={[
          [
            t('gemelo.lecturas.estacion'),
            siNo(
              lecturas.estacion,
              t('gemelo.lecturas.enMarcha'),
              t('gemelo.lecturas.detenida'),
            ),
          ],
          [
            t('gemelo.lecturas.piston'),
            siNo(
              lecturas.piston,
              t('gemelo.lecturas.afuera'),
              t('gemelo.lecturas.atras'),
            ),
          ],
          [
            t('gemelo.lecturas.piezaPresente'),
            siNo(
              lecturas.presencia,
              t('gemelo.lecturas.si'),
              t('gemelo.lecturas.no'),
            ),
          ],
          [
            t('gemelo.lecturas.piezasContadas'),
            lecturas.contador === null
              ? t('gemelo.lecturas.sinDato')
              : String(lecturas.contador),
          ],
        ]}
      />
      <p className="text-[12px] leading-snug text-suave">
        {t('gemelo.lecturas.ultima', { fecha: fechaHora(lecturas.ultima) })}
      </p>
    </>
  )
}

const MANDOS: { mando: Mando; clases: string }[] = [
  { mando: 'marcha', clases: boton('contorno') },
  { mando: 'paro', clases: boton('neutro') },
  { mando: 'emergencia', clases: `${boton('alerta')} col-span-2` },
  { mando: 'restablecer', clases: `${boton('neutro')} col-span-2` },
]

export default function PaginaGemelo({
  obtenerLecturas,
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
  const marco = useRef<HTMLDivElement>(null)
  const contadorAnterior = useRef<number | null>(null)

  // En vivo se consulta la nube cada pocos segundos.
  useEffect(() => {
    if (modo !== 'vivo') return
    let vigente = true
    const consultar = () =>
      obtenerLecturas().then((resultado) => {
        if (!vigente) return
        if (!resultado.ok) {
          if (resultado.motivo === 'sesion') sesionCaducada()
          else setConsulta({ enlace: 'sin_conexion', lecturas: null })
          return
        }
        const lecturas = resumirLecturas(resultado.lecturas)
        pedirCiclos(
          gemelo,
          piezasNuevas(contadorAnterior.current, lecturas.contador),
        )
        if (lecturas.contador !== null)
          contadorAnterior.current = lecturas.contador
        setConsulta({
          enlace: estadoEnlace(lecturas, Date.now()),
          lecturas,
        })
      })
    consultar()
    const reloj = setInterval(consultar, SEGUNDOS_ENTRE_CONSULTAS * 1000)
    return () => {
      vigente = false
      clearInterval(reloj)
    }
  }, [modo, gemelo, obtenerLecturas, sesionCaducada])

  const refrescar = useCallback(
    () => setInstantanea(tomarInstantanea(gemelo)),
    [gemelo],
  )
  const alPulsar = useCallback(
    (mando: Mando) => pulsar(gemelo, mando),
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
    contadorAnterior.current = null
    setConsulta({ enlace: 'conectando', lecturas: null })
    setModo(nuevo)
  }

  const i = instantanea
  const enVivo = modo === 'vivo'
  const estado = estadoCelda(i, modo, t)
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
        <span className={`${CHIP} ${estado.clases}`}>{estado.texto}</span>
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
          const activo = indice === 6 ? i.empacando : i.paso === indice + 1
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
              alPulsar={alPulsar}
            />
          </Suspense>
        </div>

        <section
          data-obstaculo
          aria-label={
            enVivo
              ? t('gemelo.paneles.lecturasVista')
              : t('gemelo.paneles.mandosVista')
          }
          className={`${PANEL} lg:top-3 lg:left-3 lg:w-[236px]`}
        >
          {enVivo ? (
            <LecturasReales consulta={consulta} />
          ) : (
            <div>
              <h2 className={SUBTITULO}>{t('gemelo.mandos.titulo')}</h2>
              <div className="grid grid-cols-2 gap-2">
                {MANDOS.map(({ mando, clases }) => (
                  <button
                    key={mando}
                    type="button"
                    onClick={() => pulsar(gemelo, mando)}
                    className={clases}
                  >
                    {t(`gemelo.mandos.${mando}`)}
                  </button>
                ))}
              </div>
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
                onChange={(evento) => {
                  const nueva = Number(evento.target.value)
                  ponerVelocidad(gemelo, nueva)
                  setVelocidad(nueva)
                }}
                className="w-full accent-acento"
              />
            </label>
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
              {t('gemelo.soloCuatro')}
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
                t('gemelo.valores.destinoCarro'),
                i.posX
                  ? t('gemelo.valores.carril', { n: i.posX })
                  : t('gemelo.valores.toma'),
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
