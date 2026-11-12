import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, CheckCircle, Magnifier } from 'reicon-react'
import { avisoClases, boton, CAMPO_BUSQUEDA, TARJETA } from '../comun/estilos'
import { iniciales } from '../comun/iniciales'
import Segmentos from '../comun/Segmentos'
import MarcoPanel from './MarcoPanel'
import { coincide } from './buscar'
import { fechaCorta } from './tiempo'
import type {
  Cuenta,
  DecisionCuenta,
  FiltroCuentas,
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

const FILTROS: FiltroCuentas[] = ['pendiente', 'aprobado', 'rechazado', 'todas']

const PRIMARIO = boton('principal')
const CONTORNO = boton('contorno')
const PELIGRO = boton('peligro')

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
  const { t } = useTranslation()
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
      setAviso({
        error: true,
        texto: t(`cuentas.errores.${resultado.motivo}`),
      })
      // si ya cambio de estado o no existe, la lista estaba vieja
      if (resultado.motivo !== 'fallo') setVersion((v) => v + 1)
    }
  }

  function decidirSobre(cuenta: Cuenta, decision: DecisionCuenta) {
    const hecho =
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
      t(`cuentas.avisos.${hecho}`, { nombre: cuenta.nombre }),
    )
  }

  return (
    <MarcoPanel titulo={t('cuentas.titulo')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentos
          opciones={FILTROS.map((valor) => ({
            valor,
            texto: t(`cuentas.filtros.${valor}`),
          }))}
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
            aria-label={t('cuentas.buscar')}
            placeholder={t('cuentas.buscar')}
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

      {cargando && <p className="text-suave">{t('general.cargando')}</p>}

      {!cargando && !carga.resultado.ok && (
        <p role="alert" className="text-[14px] text-alerta">
          {t('cuentas.errorLista')}
        </p>
      )}

      {!cargando && carga.resultado.ok && (
        <>
          {todas.length === 0 && (
            <p className="text-[14px] text-suave">
              {t(`cuentas.vacio.${filtro}`)}
            </p>
          )}
          {todas.length > 0 && (
            <p role="status" className="-mb-2 text-[12px] text-suave">
              {buscando
                ? t('cuentas.encontradas', {
                    visibles: visibles.length,
                    total: todas.length,
                    texto: busqueda.trim(),
                  })
                : t('cuentas.total', { count: todas.length })}
            </p>
          )}
          {todas.length > 0 && visibles.length === 0 && (
            <p className="text-[14px] text-suave">
              {t('cuentas.nadie', { texto: busqueda.trim() })}
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
                            {t('cuentas.bloqueada')}
                          </span>
                        )}
                      </p>
                      <p className="text-[13px] break-all text-suave">
                        {cuenta.correo}
                      </p>
                      <p className="text-[12px] text-suave">
                        {t('cuentas.solicitada', {
                          fecha: fechaCorta(cuenta.creadoEn),
                        })}{' '}
                        · {t(`cuentas.estados.${cuenta.estado}`)}
                        {!esUsuario && ` · ${t('cuentas.administrador')}`}
                      </p>
                    </div>
                  </div>

                  {confirmando === cuenta.id ? (
                    <div className="flex flex-col gap-3 sm:max-w-[340px]">
                      <p className="text-[13.5px]">
                        {t('cuentas.confirmarAntes')}{' '}
                        <strong>{cuenta.nombre}</strong>
                        {t('cuentas.confirmarDespues')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() =>
                            ejecutar(
                              cuenta,
                              () => hacerAdministrador(cuenta.id),
                              t('cuentas.avisos.ahoraAdmin', {
                                nombre: cuenta.nombre,
                              }),
                            )
                          }
                          className={PRIMARIO}
                        >
                          {t('cuentas.acciones.siHacerAdmin')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmando(null)}
                          className={CONTORNO}
                        >
                          {t('general.cancelar')}
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
                            aria-label={t('cuentas.accionesPara.aprobar', {
                              nombre: cuenta.nombre,
                            })}
                            className={PRIMARIO}
                          >
                            {t('cuentas.acciones.aprobar')}
                          </button>
                          <button
                            type="button"
                            disabled={deshabilitado}
                            onClick={() => decidirSobre(cuenta, 'rechazado')}
                            aria-label={t('cuentas.accionesPara.rechazar', {
                              nombre: cuenta.nombre,
                            })}
                            className={PELIGRO}
                          >
                            {t('cuentas.acciones.rechazar')}
                          </button>
                        </>
                      )}
                      {esUsuario && cuenta.estado === 'aprobado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => decidirSobre(cuenta, 'rechazado')}
                          aria-label={t('cuentas.accionesPara.desactivar', {
                            nombre: cuenta.nombre,
                          })}
                          className={PELIGRO}
                        >
                          {t('cuentas.acciones.desactivar')}
                        </button>
                      )}
                      {esUsuario && cuenta.estado === 'rechazado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => decidirSobre(cuenta, 'aprobado')}
                          aria-label={t('cuentas.accionesPara.reactivar', {
                            nombre: cuenta.nombre,
                          })}
                          className={PRIMARIO}
                        >
                          {t('cuentas.acciones.reactivar')}
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
                              t('cuentas.avisos.desbloqueada', {
                                nombre: cuenta.nombre,
                              }),
                            )
                          }
                          aria-label={t('cuentas.accionesPara.desbloquear', {
                            nombre: cuenta.nombre,
                          })}
                          className={CONTORNO}
                        >
                          {t('cuentas.acciones.desbloquear')}
                        </button>
                      )}
                      {esUsuario && cuenta.estado === 'aprobado' && (
                        <button
                          type="button"
                          disabled={deshabilitado}
                          onClick={() => setConfirmando(cuenta.id)}
                          aria-label={t('cuentas.accionesPara.hacerAdmin', {
                            nombre: cuenta.nombre,
                          })}
                          className={CONTORNO}
                        >
                          {t('cuentas.acciones.hacerAdmin')}
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
