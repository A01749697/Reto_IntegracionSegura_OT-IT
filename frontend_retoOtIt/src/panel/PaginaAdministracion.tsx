import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, Magnifier } from 'reicon-react'
import { avisoClases, boton, CAMPO_BUSQUEDA, TARJETA } from '../comun/estilos'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from './MarcoPanel'
import { coincide } from './buscar'
import type {
  Cuenta,
  DecisionCuenta,
  EstadoCuenta,
  FiltroCuentas,
  MotivoDecision,
  ResultadoDecision,
  ResultadoLista,
} from './apiAdministracion'

type Props = {
  listar: (filtro: FiltroCuentas) => Promise<ResultadoLista>
  decidir: (id: number, decision: DecisionCuenta) => Promise<ResultadoDecision>
  desbloquear: (id: number) => Promise<ResultadoDecision>
  hacerAdministrador: (id: number) => Promise<ResultadoDecision>
  sesionCaducada: () => void
}

const FILTROS: { valor: FiltroCuentas; texto: string }[] = [
  { valor: 'pendiente', texto: 'Pendientes' },
  { valor: 'aprobado', texto: 'Aprobadas' },
  { valor: 'rechazado', texto: 'Rechazadas' },
  { valor: 'todas', texto: 'Todas' },
]

const VACIO: Record<FiltroCuentas, string> = {
  pendiente: 'No hay cuentas pendientes.',
  aprobado: 'No hay cuentas aprobadas.',
  rechazado: 'No hay cuentas rechazadas.',
  todas: 'No hay cuentas.',
}

const ETIQUETA_ESTADO: Record<EstadoCuenta, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
}

const MENSAJES_ERROR: Record<Exclude<MotivoDecision, 'sesion'>, string> = {
  no_existe: 'La cuenta ya no existe.',
  no_permitido: 'Esa cuenta no se puede cambiar desde el panel.',
  sin_cambio: 'La cuenta ya tenía ese estado.',
  fallo: 'No se pudo completar. Inténtalo otra vez.',
}

const PRIMARIO = boton('principal')
const CONTORNO = boton('contorno')
const PELIGRO = boton('peligro')

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type Carga = {
  filtro: FiltroCuentas
  version: number
  resultado: ResultadoLista
}

export default function PaginaAdministracion({
  listar,
  decidir,
  desbloquear,
  hacerAdministrador,
  sesionCaducada,
}: Props) {
  const [filtro, setFiltro] = useState<FiltroCuentas>('pendiente')
  const [busqueda, setBusqueda] = useState('')
  const [version, setVersion] = useState(0)
  const [carga, setCarga] = useState<Carga | null>(null)
  const [ocupada, setOcupada] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ error: boolean; texto: string } | null>(
    null,
  )

  useEffect(() => {
    let vigente = true
    listar(filtro).then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else setCarga({ filtro, version, resultado })
    })
    return () => {
      vigente = false
    }
  }, [listar, filtro, version, sesionCaducada])

  const cargando =
    carga === null || carga.filtro !== filtro || carga.version !== version

  const todas = !cargando && carga.resultado.ok ? carga.resultado.cuentas : []
  const visibles = todas.filter((c) => coincide(c.nombre, busqueda))
  const buscando = busqueda.trim() !== ''

  function cambiarFiltro(nuevo: FiltroCuentas) {
    setAviso(null)
    setConfirmando(null)
    setFiltro(nuevo)
  }

  async function ejecutar(
    cuenta: Cuenta,
    accion: () => Promise<ResultadoDecision>,
    exito: string,
  ) {
    setOcupada(cuenta.id)
    setConfirmando(null)
    setAviso(null)
    let resultado: ResultadoDecision
    try {
      resultado = await accion()
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setOcupada(null)
    if (resultado.ok) {
      setAviso({ error: false, texto: exito })
      setVersion((v) => v + 1)
    } else if (resultado.motivo === 'sesion') {
      sesionCaducada()
    } else {
      setAviso({ error: true, texto: MENSAJES_ERROR[resultado.motivo] })
      // si ya cambio de estado o no existe, la lista estaba vieja
      if (resultado.motivo !== 'fallo') setVersion((v) => v + 1)
    }
  }

  function decidirSobre(cuenta: Cuenta, decision: DecisionCuenta) {
    const verbo =
      decision === 'aprobado'
        ? cuenta.estado === 'rechazado'
          ? 'reactivada'
          : 'aprobada'
        : cuenta.estado === 'aprobado'
          ? 'desactivada'
          : 'rechazada'
    return ejecutar(
      cuenta,
      () => decidir(cuenta.id, decision),
      `Cuenta ${verbo}: ${cuenta.nombre}.`,
    )
  }

  return (
    <MarcoPanel titulo="Cuentas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentos
          opciones={FILTROS}
          valor={filtro}
          alCambiar={cambiarFiltro}
        />
        <div className="relative w-full sm:w-[290px]">
          <Magnifier
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute top-[10px] left-3 text-suave"
          />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar por nombre"
            placeholder="Buscar por nombre"
            autoComplete="off"
            className={CAMPO_BUSQUEDA}
          />
        </div>
      </div>

      {aviso && (
        <div
          role={aviso.error ? 'alert' : 'status'}
          className={avisoClases(aviso.error)}
        >
          {aviso.error ? (
            <AlertCircle
              size={18}
              aria-hidden="true"
              className="mt-px shrink-0"
            />
          ) : (
            <CheckCircle
              size={18}
              aria-hidden="true"
              className="mt-px shrink-0"
            />
          )}
          <span>{aviso.texto}</span>
        </div>
      )}

      {cargando && <p className="text-suave">Cargando...</p>}

      {!cargando && !carga.resultado.ok && (
        <p role="alert" className="text-[14px] text-alerta">
          No se pudo cargar la lista. Inténtalo otra vez.
        </p>
      )}

      {!cargando && carga.resultado.ok && (
        <>
          {todas.length === 0 && (
            <p className="text-[14px] text-suave">{VACIO[filtro]}</p>
          )}
          {todas.length > 0 && (
            <p role="status" className="-mb-2 text-[12px] text-suave">
              {buscando
                ? `${visibles.length} de ${todas.length} cuentas con «${busqueda.trim()}»`
                : `${todas.length} ${todas.length === 1 ? 'cuenta' : 'cuentas'}`}
            </p>
          )}
          {todas.length > 0 && visibles.length === 0 && (
            <p className="text-[14px] text-suave">
              Nadie coincide con «{busqueda.trim()}».
            </p>
          )}
          <ul className={`${TARJETA} flex flex-col empty:hidden`}>
            {visibles.map((cuenta) => {
              const esUsuario = cuenta.rol === 'usuario'
              const deshabilitado = ocupada === cuenta.id
              return (
                <li
                  key={cuenta.id}
                  className="flex flex-col gap-3 border-b border-linea px-5 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-linea bg-fondo text-[13px] font-bold"
                    >
                      {iniciales(cuenta.nombre)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold break-words">
                        <span>{cuenta.nombre}</span>
                        {cuenta.bloqueada && (
                          <span className="rounded-[5px] bg-alerta/15 px-2 py-0.5 text-[12px] font-bold text-alerta">
                            Bloqueada
                          </span>
                        )}
                      </p>
                      <p className="text-[13px] break-all text-suave">
                        {cuenta.correo}
                      </p>
                      <p className="text-[12px] text-suave">
                        Solicitada el {fechaCorta(cuenta.creadoEn)} ·{' '}
                        {ETIQUETA_ESTADO[cuenta.estado]}
                        {!esUsuario && ' · Administrador'}
                      </p>
                    </div>
                  </div>

                  {confirmando === cuenta.id ? (
                    <div className="flex flex-col gap-3 sm:max-w-[340px]">
                      <p className="text-[13.5px]">
                        ¿Dar acceso de administrador a{' '}
                        <strong>{cuenta.nombre}</strong>? Desde el panel no se
                        puede deshacer.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() =>
                            ejecutar(
                              cuenta,
                              () => hacerAdministrador(cuenta.id),
                              `${cuenta.nombre} ahora es administrador.`,
                            )
                          }
                          className={PRIMARIO}
                        >
                          Sí, hacer administrador
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmando(null)}
                          className={CONTORNO}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {esUsuario && cuenta.estado === 'pendiente' && (
                        <>
                          <button
                            type="button"
                            disabled={deshabilitado}
                            onClick={() => decidirSobre(cuenta, 'aprobado')}
                            aria-label={`Aprobar a ${cuenta.nombre}`}
                            className={PRIMARIO}
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            disabled={deshabilitado}
                            onClick={() => decidirSobre(cuenta, 'rechazado')}
                            aria-label={`Rechazar a ${cuenta.nombre}`}
                            className={PELIGRO}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                      {esUsuario && cuenta.estado === 'aprobado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => decidirSobre(cuenta, 'rechazado')}
                          aria-label={`Desactivar a ${cuenta.nombre}`}
                          className={PELIGRO}
                        >
                          Desactivar
                        </button>
                      )}
                      {esUsuario && cuenta.estado === 'rechazado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => decidirSobre(cuenta, 'aprobado')}
                          aria-label={`Reactivar a ${cuenta.nombre}`}
                          className={PRIMARIO}
                        >
                          Reactivar
                        </button>
                      )}
                      {cuenta.bloqueada && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() =>
                            ejecutar(
                              cuenta,
                              () => desbloquear(cuenta.id),
                              `Cuenta desbloqueada: ${cuenta.nombre}.`,
                            )
                          }
                          aria-label={`Desbloquear a ${cuenta.nombre}`}
                          className={CONTORNO}
                        >
                          Desbloquear
                        </button>
                      )}
                      {esUsuario && cuenta.estado === 'aprobado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => setConfirmando(cuenta.id)}
                          aria-label={`Hacer administrador a ${cuenta.nombre}`}
                          className={CONTORNO}
                        >
                          Hacer administrador
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </MarcoPanel>
  )
}
