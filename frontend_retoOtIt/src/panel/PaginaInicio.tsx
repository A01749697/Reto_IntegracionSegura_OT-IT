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

const LLEGADA: Record<EstadoSistema['datos'], { tono: Tono; texto: string }> = {
  al_dia: { tono: 'bien', texto: 'Al día' },
  retrasado: { tono: 'mal', texto: 'Retrasado' },
  sin_datos: { tono: 'neutro', texto: 'Sin lecturas' },
  desconocido: { tono: 'mal', texto: 'No se pudo saber' },
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

function textoDe<T>(dato: Dato<T>, listo: (valor: T) => string): string {
  if (dato === null) return 'Cargando...'
  if (dato === 'error') return 'No se pudo cargar'
  return listo(dato)
}

function ultimaLectura(estado: EstadoSistema): string {
  if (estado.variables.length === 0) return 'Aún no llega ninguna lectura'
  const menor = Math.min(
    ...estado.variables.map((v) => v.segundosDesdeRecibida),
  )
  return `Última lectura ${hace(menor)}`
}

export default function PaginaInicio({
  usuario,
  obtenerEstado,
  listarPendientes,
  listarEventos,
  irA,
  sesionCaducada,
}: Props) {
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
    listaEventos = <p className="px-5 py-4 text-suave">Cargando...</p>
  } else if (eventos === 'error') {
    listaEventos = (
      <p role="alert" className="px-5 py-4 text-[14px] text-alerta">
        No se pudieron cargar los eventos.
      </p>
    )
  } else if (eventos.length === 0) {
    listaEventos = (
      <p className="px-5 py-4 text-suave">Todavía no hay eventos.</p>
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
                {evento.correo ?? 'Sin correo'}
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
    <MarcoPanel titulo="Inicio">
      <div className="flex flex-col gap-1">
        <p className="text-[17px]">
          Hola, <strong>{usuario.nombre}</strong>.
        </p>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-suave">
          <div className="flex gap-2">
            <dt className="font-semibold">Correo:</dt>
            <dd className="break-all">{usuario.correo}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold">Rol:</dt>
            <dd>{usuario.rol}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {esAdmin && (
          <Resumen
            titulo="Cuentas pendientes"
            Icono={Users}
            valor={textoDe(pendientes, (n) => String(n))}
            tono={
              typeof pendientes === 'number' && pendientes > 0
                ? 'mal'
                : 'neutro'
            }
            detalle={
              typeof pendientes === 'number' && pendientes > 0
                ? 'Esperan que las apruebes o las rechaces'
                : 'Nadie espera aprobación'
            }
            accion="Revisar cuentas"
            alPulsar={() => irA('cuentas')}
          />
        )}
        <Resumen
          titulo="Servicios"
          Icono={Server}
          valor={textoDe(estado, () =>
            fallas === 0 ? 'Todo responde' : `${fallas} con falla`,
          )}
          tono={listo ? (fallas === 0 ? 'bien' : 'mal') : 'neutro'}
          detalle="API del panel y las dos bases de datos"
          accion="Ver estado"
          alPulsar={() => irA('estado')}
        />
        <Resumen
          titulo="Llegada de datos"
          Icono={Pulse}
          valor={textoDe(estado, (e) => LLEGADA[e.datos].texto)}
          tono={listo ? LLEGADA[listo.datos].tono : 'neutro'}
          detalle={listo ? ultimaLectura(listo) : 'Lecturas del agente IT'}
          accion="Ver lecturas"
          alPulsar={() => irA('estado')}
        />
        <Resumen
          titulo="Variables vigiladas"
          Icono={Database}
          valor={textoDe(estado, (e) => String(e.variables.length))}
          tono="neutro"
          detalle="Variables de PLC con al menos una lectura"
          accion="Ver detalle"
          alPulsar={() => irA('estado')}
        />
      </div>

      {esAdmin && (
        <section className={TARJETA} aria-label="Últimos eventos">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
              <History size={18} aria-hidden="true" className="text-acento" />
              Últimos eventos de seguridad
            </h2>
            <button
              type="button"
              onClick={() => irA('bitacora')}
              className={boton('neutro')}
            >
              Ver bitácora
            </button>
          </div>
          {listaEventos}
        </section>
      )}

      <p className="text-[14px] text-suave">
        Todavía no está el dashboard con las lecturas de los PLC.
      </p>
    </MarcoPanel>
  )
}
