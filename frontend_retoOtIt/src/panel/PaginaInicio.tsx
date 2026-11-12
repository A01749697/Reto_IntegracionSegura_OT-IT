import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Database, History, Pulse, Server, Users } from 'reicon-react'
import { boton, TARJETA } from '../comun/estilos'
import type { Usuario } from '../login/apiPanel'
import type { ResultadoLista } from './apiAdministracion'
import type { EventoBitacora, ResultadoBitacora } from './apiBitacora'
import type { EstadoSistema, ResultadoEstado } from './apiSistema'
import type { Seccion } from './EncabezadoPanel'
import { describir } from './eventos'
import IconoEvento from './IconoEvento'
import MarcoPanel from './MarcoPanel'
import { fechaHora, hace } from './tiempo'

type Props = {
  usuario: Usuario
  obtenerEstado: () => Promise<ResultadoEstado>
  listarPendientes: () => Promise<ResultadoLista>
  listarEventos: () => Promise<ResultadoBitacora>
  irA: (seccion: Seccion) => void
  sesionCaducada: () => void
}

type Icono = ComponentType<{ size?: number; className?: string }>
type Tono = 'bien' | 'mal' | 'neutro'

// null = cargando, 'error' = no se pudo
type Dato<T> = T | 'error' | null

const TONOS: Record<Tono, string> = {
  bien: 'text-ok',
  mal: 'text-alerta',
  neutro: 'text-texto',
}

const TONO_LLEGADA: Record<EstadoSistema['datos'], Tono> = {
  al_dia: 'bien',
  retrasado: 'mal',
  sin_datos: 'neutro',
  desconocido: 'mal',
}

const CUANTOS_EVENTOS = 6

function Resumen({
  titulo,
  Icono,
  valor,
  tono,
  detalle,
  accion,
  alPulsar,
}: {
  titulo: string
  Icono: Icono
  valor: string
  tono: Tono
  detalle: string
  accion: string
  alPulsar: () => void
}) {
  return (
    <section className={`${TARJETA} flex flex-col gap-3 px-5 py-4`}>
      <h2 className="flex items-center gap-2.5 text-[13px] font-semibold text-suave">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-linea bg-fondo text-acento"
        >
          <Icono size={16} />
        </span>
        {titulo}
      </h2>
      <p className={`text-[24px] leading-tight font-bold ${TONOS[tono]}`}>
        {valor}
      </p>
      <p className="text-[12.5px] text-suave">{detalle}</p>
      <button
        type="button"
        onClick={alPulsar}
        className={`${boton('neutro')} mt-auto self-start`}
      >
        {accion}
      </button>
    </section>
  )
}

function textoDe<T>(
  dato: Dato<T>,
  t: TFunction,
  listo: (valor: T) => string,
): string {
  if (dato === null) return t('general.cargando')
  if (dato === 'error') return t('general.noSePudoCargar')
  return listo(dato)
}

function ultimaLectura(estado: EstadoSistema, t: TFunction): string {
  if (estado.variables.length === 0) return t('general.sinLecturas')
  const menor = Math.min(
    ...estado.variables.map((v) => v.segundosDesdeRecibida),
  )
  return t('general.ultimaLectura', { hace: hace(menor) })
}

export default function PaginaInicio({
  usuario,
  obtenerEstado,
  listarPendientes,
  listarEventos,
  irA,
  sesionCaducada,
}: Props) {
  const { t } = useTranslation()
  const esAdmin = usuario.rol === 'administrador'
  const [estado, setEstado] = useState<Dato<EstadoSistema>>(null)
  const [pendientes, setPendientes] = useState<Dato<number>>(null)
  const [eventos, setEventos] = useState<Dato<EventoBitacora[]>>(null)

  useEffect(() => {
    let vigente = true
    obtenerEstado().then((r) => {
      if (!vigente) return
      if (!r.ok && r.motivo === 'sesion') sesionCaducada()
      else setEstado(r.ok ? r.estado : 'error')
    })
    if (esAdmin) {
      listarPendientes().then((r) => {
        if (!vigente) return
        if (!r.ok && r.motivo === 'sesion') sesionCaducada()
        else setPendientes(r.ok ? r.cuentas.length : 'error')
      })
      listarEventos().then((r) => {
        if (!vigente) return
        if (!r.ok && r.motivo === 'sesion') sesionCaducada()
        else setEventos(r.ok ? r.eventos.slice(0, CUANTOS_EVENTOS) : 'error')
      })
    }
    return () => {
      vigente = false
    }
  }, [obtenerEstado, listarPendientes, listarEventos, esAdmin, sesionCaducada])

  const listo = typeof estado === 'object' && estado !== null ? estado : null
  const fallas = listo
    ? [listo.baseDatosPanel, listo.baseDatosLecturas].filter((p) => p !== 'ok')
        .length
    : 0

  let listaEventos: ReactNode
  if (eventos === null) {
    listaEventos = (
      <p className="px-5 py-4 text-suave">{t('general.cargando')}</p>
    )
  } else if (eventos === 'error') {
    listaEventos = (
      <p role="alert" className="px-5 py-4 text-[14px] text-alerta">
        {t('inicio.eventos.error')}
      </p>
    )
  } else if (eventos.length === 0) {
    listaEventos = (
      <p className="px-5 py-4 text-suave">{t('inicio.eventos.vacio')}</p>
    )
  } else {
    listaEventos = (
      <ul>
        {eventos.map((evento) => (
          <li
            key={evento.id}
            className="flex items-center gap-3 border-t border-linea px-5 py-2.5"
          >
            <IconoEvento tipo={evento.tipo} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold">
                {describir(evento)}
              </p>
              <p className="truncate text-[12.5px] text-suave">
                {evento.correo ?? t('general.sinCorreo')}
              </p>
            </div>
            <p className="hidden text-[12.5px] whitespace-nowrap text-suave sm:block">
              {fechaHora(evento.ocurrioEn)}
            </p>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <MarcoPanel titulo={t('inicio.titulo')}>
      <div className="flex flex-col gap-1">
        <p className="text-[17px]">
          {t('inicio.hola')} <strong>{usuario.nombre}</strong>.
        </p>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-suave">
          <div className="flex gap-2">
            <dt className="font-semibold">{t('general.campoCorreo')}</dt>
            <dd className="break-all">{usuario.correo}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold">{t('general.campoRol')}</dt>
            <dd>{t(`general.roles.${usuario.rol}`)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {esAdmin && (
          <Resumen
            titulo={t('inicio.pendientes.titulo')}
            Icono={Users}
            valor={textoDe(pendientes, t, (n) => String(n))}
            tono={
              typeof pendientes === 'number' && pendientes > 0
                ? 'mal'
                : 'neutro'
            }
            detalle={
              typeof pendientes === 'number' && pendientes > 0
                ? t('inicio.pendientes.algunas')
                : t('inicio.pendientes.ninguna')
            }
            accion={t('inicio.pendientes.accion')}
            alPulsar={() => irA('cuentas')}
          />
        )}
        <Resumen
          titulo={t('inicio.servicios.titulo')}
          Icono={Server}
          valor={textoDe(estado, t, () =>
            fallas === 0
              ? t('inicio.servicios.todoResponde')
              : t('inicio.servicios.conFalla', { n: fallas }),
          )}
          tono={listo ? (fallas === 0 ? 'bien' : 'mal') : 'neutro'}
          detalle={t('inicio.servicios.detalle')}
          accion={t('inicio.servicios.accion')}
          alPulsar={() => irA('estado')}
        />
        <Resumen
          titulo={t('inicio.llegada.titulo')}
          Icono={Pulse}
          valor={textoDe(estado, t, (e) =>
            t(`inicio.llegada.estados.${e.datos}`),
          )}
          tono={listo ? TONO_LLEGADA[listo.datos] : 'neutro'}
          detalle={
            listo ? ultimaLectura(listo, t) : t('inicio.llegada.detalle')
          }
          accion={t('inicio.llegada.accion')}
          alPulsar={() => irA('estado')}
        />
        <Resumen
          titulo={t('inicio.variables.titulo')}
          Icono={Database}
          valor={textoDe(estado, t, (e) => String(e.variables.length))}
          tono="neutro"
          detalle={t('inicio.variables.detalle')}
          accion={t('inicio.variables.accion')}
          alPulsar={() => irA('estado')}
        />
      </div>

      {esAdmin && (
        <section className={TARJETA} aria-label={t('inicio.eventos.etiqueta')}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
              <History size={18} aria-hidden="true" className="text-acento" />
              {t('inicio.eventos.titulo')}
            </h2>
            <button
              type="button"
              onClick={() => irA('bitacora')}
              className={boton('neutro')}
            >
              {t('inicio.eventos.verBitacora')}
            </button>
          </div>
          {listaEventos}
        </section>
      )}

      <p className="text-[14px] text-suave">{t('inicio.sinDashboard')}</p>
    </MarcoPanel>
  )
}
