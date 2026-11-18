import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertCircle,
  ArrowUp,
  CheckCircle,
  Envelope,
  Eye,
  EyeClosed,
  Lock,
  User,
  UserAdd,
} from 'reicon-react'
import CaminoZonas from '../comun/CaminoZonas'
import { avisoClases, boton } from '../comun/estilos'
import FranjaZonas from '../comun/FranjaZonas'
import SelectorIdioma from '../idioma/SelectorIdioma'
import BotonTema from '../tema/BotonTema'
import CampoTexto from './CampoTexto'
import type { ResultadoEntrar, ResultadoSimple, Usuario } from './apiPanel'

export type DatosCuenta = { nombre: string; correo: string; clave: string }

export type PaginaLoginProps = {
  autenticar: (correo: string, clave: string) => Promise<ResultadoEntrar>
  solicitarCuenta: (datos: DatosCuenta) => Promise<ResultadoSimple>
  recuperarClave: (correo: string) => Promise<ResultadoSimple>
  restablecerClave: (token: string, clave: string) => Promise<ResultadoSimple>
  /** Se llama cuando el inicio de sesion es correcto. */
  alIniciarSesion?: (usuario: Usuario) => void
  /** Codigo del enlace del correo. Si viene, abre directo la contraseña nueva. */
  tokenInicial?: string
  /** Con que formulario abre cuando viene de la pagina de inicio. */
  vistaInicial?: 'login' | 'crear'
  /** Si viene, el nombre del panel lleva de vuelta a la pagina de inicio. */
  alVolver?: () => void
}

type Vista = 'login' | 'olvido' | 'crear' | 'restablecer'

const LARGO_MINIMO_CLAVE = 12

const BOTON_PRINCIPAL = `${boton('principal', 'grande')} w-full`
const BOTON_SECUNDARIO = `${boton('contorno', 'grande')} w-full`
const ENLACE =
  'cursor-pointer rounded px-1 py-3 text-[13px] font-medium text-acento underline underline-offset-[3px] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento'

function Aviso({
  tipo,
  children,
}: {
  tipo: 'error' | 'exito'
  children: ReactNode
}) {
  const esError = tipo === 'error'
  const Icono = esError ? AlertCircle : CheckCircle
  return (
    <div role={esError ? 'alert' : 'status'} className={avisoClases(esError)}>
      <Icono size={18} aria-hidden="true" className="mt-px shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Cargando() {
  return (
    <svg
      className="animate-spin"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 019 9" />
    </svg>
  )
}

function VistaLogin({
  autenticar,
  alIniciarSesion,
  irOlvido,
  irCrear,
}: Pick<PaginaLoginProps, 'autenticar' | 'alIniciarSesion'> & {
  irOlvido: () => void
  irCrear: () => void
}) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [mayusculas, setMayusculas] = useState(false)
  const { t } = useTranslation()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    if (!correo.trim() || !clave) {
      setAviso(t('login.errores.escribeCorreoYClave'))
      return
    }
    setCargando(true)
    let resultado: ResultadoEntrar
    try {
      resultado = await autenticar(correo.trim(), clave)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargando(false)
    if (resultado.ok) {
      setAviso('')
      alIniciarSesion?.(resultado.usuario)
    } else {
      setAviso(t(`login.errores.entrar.${resultado.motivo}`))
    }
  }

  const detectarMayusculas = (e: React.KeyboardEvent<HTMLInputElement>) =>
    setMayusculas(e.getModifierState('CapsLock'))

  return (
    <div className="flex flex-col gap-[26px]">
      <form
        onSubmit={enviar}
        noValidate
        className="flex flex-col gap-[26px]"
        aria-label={t('login.formularios.iniciarSesion')}
      >
        {aviso && <Aviso tipo="error">{aviso}</Aviso>}

        <CampoTexto
          id="correo"
          etiqueta={t('login.campos.correo')}
          Icono={Envelope}
          valor={correo}
          alCambiar={setCorreo}
          type="email"
          autoComplete="username"
          placeholder={t('login.pistas.correo')}
        />

        <div className="flex flex-col gap-2">
          <CampoTexto
            id="clave"
            etiqueta={t('login.campos.clave')}
            Icono={Lock}
            valor={clave}
            alCambiar={setClave}
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('login.pistas.tuClave')}
            onKeyUp={detectarMayusculas}
            onKeyDown={detectarMayusculas}
            onBlur={() => setMayusculas(false)}
            derecha={
              <button
                type="button"
                aria-label={
                  verClave
                    ? t('login.acciones.ocultarClave')
                    : t('login.acciones.mostrarClave')
                }
                aria-pressed={verClave}
                onClick={() => setVerClave((v) => !v)}
                className="absolute top-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-suave hover:bg-acento/10 hover:text-texto focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none"
              >
                {verClave ? (
                  <EyeClosed size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            }
          />
          {mayusculas && (
            <p
              role="status"
              className="flex items-center gap-2 text-[13px] font-medium text-ok"
            >
              <ArrowUp size={16} aria-hidden="true" />
              {t('login.avisos.bloqMayus')}
            </p>
          )}
          <div className="-mt-1 flex justify-end">
            <button type="button" className={ENLACE} onClick={irOlvido}>
              {t('login.acciones.olvidaste')}
            </button>
          </div>
        </div>

        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          {cargando ? (
            <>
              <Cargando />
              <span>{t('login.acciones.verificando')}</span>
            </>
          ) : (
            <span>{t('login.acciones.iniciarSesion')}</span>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px grow bg-linea" />
        <span className="text-[13px] text-suave">
          {t('login.acciones.sinCuenta')}
        </span>
        <div className="h-px grow bg-linea" />
      </div>

      <button type="button" className={BOTON_SECUNDARIO} onClick={irCrear}>
        <UserAdd size={20} aria-hidden="true" />
        <span>{t('login.acciones.crearCuenta')}</span>
      </button>
    </div>
  )
}

function VistaOlvido({
  recuperarClave,
  irLogin,
}: Pick<PaginaLoginProps, 'recuperarClave'> & { irLogin: () => void }) {
  const [correo, setCorreo] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { t } = useTranslation()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    setEnviado(false)
    if (!correo.trim()) {
      setError(t('login.errores.escribeCorreo'))
      return
    }
    setError('')
    setCargando(true)
    let resultado: ResultadoSimple
    try {
      resultado = await recuperarClave(correo.trim())
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargando(false)
    if (resultado.ok) {
      // Mismo mensaje exista o no la cuenta, para no revelar quien tiene cuenta.
      setEnviado(true)
    } else {
      setError(
        resultado.motivo === 'invalido'
          ? t('login.errores.correoInvalido')
          : t(`login.errores.simples.${resultado.motivo}`),
      )
    }
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <p className="text-[14px] leading-normal text-suave">
        {t('login.avisos.olvidoIntro')}
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {enviado && <Aviso tipo="exito">{t('login.avisos.olvidoEnviado')}</Aviso>}
      <form
        onSubmit={enviar}
        noValidate
        className="flex flex-col gap-[26px]"
        aria-label={t('login.formularios.recuperar')}
      >
        <CampoTexto
          id="olvido-correo"
          etiqueta={t('login.campos.correo')}
          Icono={Envelope}
          valor={correo}
          alCambiar={setCorreo}
          type="email"
          autoComplete="username"
          placeholder={t('login.pistas.correo')}
        />
        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          {t('login.acciones.enviarInstrucciones')}
        </button>
      </form>
      <div className="flex justify-center">
        <button type="button" className={ENLACE} onClick={irLogin}>
          {t('login.acciones.volverALogin')}
        </button>
      </div>
    </div>
  )
}

function VistaCrear({
  solicitarCuenta,
  irLogin,
}: Pick<PaginaLoginProps, 'solicitarCuenta'> & { irLogin: () => void }) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  const { t } = useTranslation()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    setEnviado(false)
    if (!nombre.trim() || !correo.trim() || !clave || !clave2) {
      setError(t('login.errores.completaTodo'))
      return
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
      setError(t('login.errores.claveCorta', { minimo: LARGO_MINIMO_CLAVE }))
      return
    }
    if (clave !== clave2) {
      setError(t('login.errores.noCoinciden'))
      return
    }
    setError('')
    setCargando(true)
    let resultado: ResultadoSimple
    try {
      resultado = await solicitarCuenta({
        nombre: nombre.trim(),
        correo: correo.trim(),
        clave,
      })
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargando(false)
    if (resultado.ok) {
      setEnviado(true)
      setNombre('')
      setCorreo('')
      setClave('')
      setClave2('')
    } else if (resultado.motivo === 'invalido') {
      setError(
        resultado.mensaje
          ? t('login.errores.crearConMensaje', { mensaje: resultado.mensaje })
          : t('login.errores.revisaDatos'),
      )
    } else {
      setError(t(`login.errores.simples.${resultado.motivo}`))
    }
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <p className="text-[14px] leading-normal text-suave">
        {t('login.avisos.crearIntro')}
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {enviado && <Aviso tipo="exito">{t('login.avisos.crearEnviada')}</Aviso>}
      <form
        onSubmit={enviar}
        noValidate
        className="flex flex-col gap-[22px]"
        aria-label={t('login.formularios.crear')}
      >
        <CampoTexto
          id="crear-nombre"
          etiqueta={t('login.campos.nombre')}
          Icono={User}
          valor={nombre}
          alCambiar={setNombre}
          autoComplete="name"
          placeholder={t('login.pistas.nombre')}
        />
        <CampoTexto
          id="crear-correo"
          etiqueta={t('login.campos.correo')}
          Icono={Envelope}
          valor={correo}
          alCambiar={setCorreo}
          type="email"
          autoComplete="email"
          placeholder={t('login.pistas.correo')}
        />
        <CampoTexto
          id="crear-clave"
          etiqueta={t('login.campos.clave')}
          Icono={Lock}
          valor={clave}
          alCambiar={setClave}
          type="password"
          autoComplete="new-password"
          placeholder={t('login.pistas.minimo', { minimo: LARGO_MINIMO_CLAVE })}
        />
        <CampoTexto
          id="crear-clave2"
          etiqueta={t('login.campos.repiteClave')}
          Icono={Lock}
          valor={clave2}
          alCambiar={setClave2}
          type="password"
          autoComplete="new-password"
          placeholder={t('login.pistas.repite')}
        />
        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          {t('login.acciones.enviarSolicitud')}
        </button>
      </form>
      <div className="flex justify-center">
        <button type="button" className={ENLACE} onClick={irLogin}>
          {t('login.acciones.yaTengoCuenta')}
        </button>
      </div>
    </div>
  )
}

function VistaRestablecer({
  token,
  restablecerClave,
  irLogin,
}: Pick<PaginaLoginProps, 'restablecerClave'> & {
  token: string
  irLogin: () => void
}) {
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [error, setError] = useState('')
  const [listo, setListo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const { t } = useTranslation()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    if (!clave || !clave2) {
      setError(t('login.errores.completaDos'))
      return
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
      setError(t('login.errores.claveCorta', { minimo: LARGO_MINIMO_CLAVE }))
      return
    }
    if (clave !== clave2) {
      setError(t('login.errores.noCoinciden'))
      return
    }
    setError('')
    setCargando(true)
    let resultado: ResultadoSimple
    try {
      resultado = await restablecerClave(token, clave)
    } catch {
      resultado = { ok: false, motivo: 'fallo' }
    }
    setCargando(false)
    if (resultado.ok) {
      setListo(true)
    } else if (resultado.motivo === 'invalido') {
      setError(t('login.errores.enlaceInvalido'))
    } else {
      setError(t(`login.errores.simples.${resultado.motivo}`))
    }
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-[26px]">
        <Aviso tipo="exito">{t('login.avisos.claveCambiada')}</Aviso>
        <button type="button" className={BOTON_PRINCIPAL} onClick={irLogin}>
          {t('login.acciones.irALogin')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[26px]">
      {error && <Aviso tipo="error">{error}</Aviso>}
      <form
        onSubmit={enviar}
        noValidate
        className="flex flex-col gap-[22px]"
        aria-label={t('login.formularios.restablecer')}
      >
        <CampoTexto
          id="restablecer-clave"
          etiqueta={t('login.campos.claveNueva')}
          Icono={Lock}
          valor={clave}
          alCambiar={setClave}
          type="password"
          autoComplete="new-password"
          placeholder={t('login.pistas.minimo', { minimo: LARGO_MINIMO_CLAVE })}
        />
        <CampoTexto
          id="restablecer-clave2"
          etiqueta={t('login.campos.repiteClaveNueva')}
          Icono={Lock}
          valor={clave2}
          alCambiar={setClave2}
          type="password"
          autoComplete="new-password"
          placeholder={t('login.pistas.repite')}
        />
        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          {t('login.acciones.cambiarClave')}
        </button>
      </form>
      <div className="flex justify-center">
        <button type="button" className={ENLACE} onClick={irLogin}>
          {t('login.acciones.volverALogin')}
        </button>
      </div>
    </div>
  )
}

export default function PaginaLogin({
  autenticar,
  solicitarCuenta,
  recuperarClave,
  restablecerClave,
  alIniciarSesion,
  tokenInicial,
  vistaInicial,
  alVolver,
}: PaginaLoginProps) {
  const [vista, setVista] = useState<Vista>(
    tokenInicial ? 'restablecer' : (vistaInicial ?? 'login'),
  )
  const { t } = useTranslation()
  const marca = 'text-base font-bold tracking-tight'

  return (
    <div className="flex min-h-screen flex-col font-sans text-texto">
      <FranjaZonas />
      <header className="mx-auto flex h-[60px] w-full max-w-[1040px] items-center justify-between px-4 sm:px-7">
        {alVolver ? (
          <button
            type="button"
            onClick={alVolver}
            aria-label={t('login.irAlInicio')}
            className={`${marca} cursor-pointer rounded focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none`}
          >
            {t('comun.marca')}
          </button>
        ) : (
          <span className={marca}>{t('comun.marca')}</span>
        )}
        <div className="flex items-center gap-2.5">
          <SelectorIdioma />
          <BotonTema />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-8 px-4 pt-6 pb-12 sm:px-0">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">
            {t(`login.encabezados.${vista}.titulo`)}
          </h1>
          <p className="mt-2 text-[13.5px] text-suave">
            {t(`login.encabezados.${vista}.subtitulo`)}
          </p>
        </div>

        {vista === 'login' && (
          <VistaLogin
            autenticar={autenticar}
            alIniciarSesion={alIniciarSesion}
            irOlvido={() => setVista('olvido')}
            irCrear={() => setVista('crear')}
          />
        )}
        {vista === 'olvido' && (
          <VistaOlvido
            recuperarClave={recuperarClave}
            irLogin={() => setVista('login')}
          />
        )}
        {vista === 'crear' && (
          <VistaCrear
            solicitarCuenta={solicitarCuenta}
            irLogin={() => setVista('login')}
          />
        )}
        {vista === 'restablecer' && tokenInicial && (
          <VistaRestablecer
            token={tokenInicial}
            restablecerClave={restablecerClave}
            irLogin={() => setVista('login')}
          />
        )}

        <div className="mt-4">
          <CaminoZonas tamano="compacto" />
        </div>
      </main>
    </div>
  )
}
