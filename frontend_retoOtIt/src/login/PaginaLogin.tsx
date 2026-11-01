import { useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowUp,
  CheckCircle,
  Envelope,
  Eye,
  EyeClosed,
  Lock,
  ShieldCheck,
  User,
  UserAdd,
  WindowChartLine,
} from 'reicon-react'
import CampoTexto from './CampoTexto'
import DiagramaFlujo from './DiagramaFlujo'
import FondoOnda from './FondoOnda'
import type {
  MotivoEntrar,
  ResultadoEntrar,
  ResultadoSimple,
  Usuario,
} from './apiPanel'

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
}

type Vista = 'login' | 'olvido' | 'crear' | 'restablecer'

const LARGO_MINIMO_CLAVE = 12

const MENSAJES_ENTRAR: Record<MotivoEntrar, string> = {
  credenciales: 'Correo o contraseña incorrectos.',
  pendiente: 'Tu cuenta todavía está pendiente de aprobación.',
  rechazada: 'Tu cuenta no fue aprobada.',
  bloqueada:
    'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  limite: 'Demasiados intentos desde esta red. Espera unos minutos.',
  invalido: 'Revisa que el correo y la contraseña estén bien escritos.',
  fallo: 'No se pudo conectar con el servidor. Inténtalo más tarde.',
}

const MENSAJES_SIMPLES = {
  limite: 'Demasiadas peticiones desde esta red. Espera unos minutos.',
  fallo: 'No se pudo completar. Inténtalo más tarde.',
}

const BOTON_BASE =
  'flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[10px] text-[17px] font-semibold focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-75'
const BOTON_PRINCIPAL = `${BOTON_BASE} bg-[linear-gradient(90deg,#174ea6,#2f6fe0)] text-white hover:bg-[linear-gradient(90deg,#123f86,#2560c8)]`
const BOTON_SECUNDARIO = `${BOTON_BASE} border-2 border-azul-idmz bg-white text-[#174ea6] hover:bg-[#eef4ff]`
const ENLACE =
  'cursor-pointer rounded px-1 py-3 text-[15px] font-medium text-[#174ea6] underline underline-offset-[3px] hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa'

const ENCABEZADOS: Record<Vista, { titulo: string; subtitulo: string }> = {
  login: {
    titulo: 'Panel Reto OT-IT',
    subtitulo: 'Inicia sesión para ver las lecturas de los PLC.',
  },
  olvido: {
    titulo: 'Recuperar contraseña',
    subtitulo: 'Te ayudamos a volver a entrar.',
  },
  crear: {
    titulo: 'Crear cuenta',
    subtitulo: 'Solicita acceso al panel del reto.',
  },
  restablecer: {
    titulo: 'Contraseña nueva',
    subtitulo: 'Escribe la contraseña nueva de tu cuenta.',
  },
}

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
    <div
      role={esError ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[15px] leading-snug ${
        esError
          ? 'border-[#e5848c] bg-[#fdecee] text-[#8a1c26]'
          : 'border-turquesa bg-[#e6f6f6] text-[#064e4e]'
      }`}
    >
      <Icono
        size={18}
        aria-hidden="true"
        className={`mt-px shrink-0 ${esError ? 'text-[#b3202d]' : 'text-turquesa-oscuro'}`}
      />
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

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    if (!correo.trim() || !clave) {
      setAviso('Escribe tu correo y tu contraseña.')
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
      setAviso(MENSAJES_ENTRAR[resultado.motivo])
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
        aria-label="Iniciar sesión"
      >
        {aviso && <Aviso tipo="error">{aviso}</Aviso>}

        <CampoTexto
          id="correo"
          etiqueta="Correo"
          Icono={Envelope}
          valor={correo}
          alCambiar={setCorreo}
          type="email"
          autoComplete="username"
          placeholder="correo@ejemplo.com"
        />

        <div className="flex flex-col gap-2">
          <CampoTexto
            id="clave"
            etiqueta="Contraseña"
            Icono={Lock}
            valor={clave}
            alCambiar={setClave}
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            onKeyUp={detectarMayusculas}
            onKeyDown={detectarMayusculas}
            onBlur={() => setMayusculas(false)}
            derecha={
              <button
                type="button"
                aria-label={
                  verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
                aria-pressed={verClave}
                onClick={() => setVerClave((v) => !v)}
                className="absolute top-1.5 right-1.5 flex h-[46px] w-[46px] cursor-pointer items-center justify-center rounded-lg text-gris-azul hover:bg-[#e3eeff] hover:text-tinta focus-visible:ring-[3px] focus-visible:ring-turquesa/45 focus-visible:outline-none"
              >
                {verClave ? (
                  <EyeClosed size={22} aria-hidden="true" />
                ) : (
                  <Eye size={22} aria-hidden="true" />
                )}
              </button>
            }
          />
          {mayusculas && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-[#0b5c5c]"
            >
              <ArrowUp
                size={16}
                aria-hidden="true"
                className="text-turquesa-oscuro"
              />
              Bloq Mayús está activado
            </p>
          )}
          <div className="-mt-1 flex justify-end">
            <button type="button" className={ENLACE} onClick={irOlvido}>
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </div>

        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          {cargando ? (
            <>
              <Cargando />
              <span>Verificando...</span>
            </>
          ) : (
            <span>Iniciar sesión</span>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px grow bg-[#cfdef5]" />
        <span className="text-sm text-gris-azul">¿Aún no tienes cuenta?</span>
        <div className="h-px grow bg-[#cfdef5]" />
      </div>

      <button type="button" className={BOTON_SECUNDARIO} onClick={irCrear}>
        <UserAdd size={20} aria-hidden="true" />
        <span>Crear cuenta</span>
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

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    setEnviado(false)
    if (!correo.trim()) {
      setError('Escribe tu correo.')
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
          ? 'Escribe un correo válido.'
          : MENSAJES_SIMPLES[resultado.motivo],
      )
    }
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <p className="text-[17px] leading-normal text-tinta-suave">
        Escribe tu correo. Si la cuenta existe, te enviaremos las instrucciones
        para crear una contraseña nueva.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {enviado && (
        <Aviso tipo="exito">
          Listo. Revisa tu correo en unos minutos, también la carpeta de spam.
          Si no llega, avisa a un integrante del equipo.
        </Aviso>
      )}
      <form
        onSubmit={enviar}
        noValidate
        className="flex flex-col gap-[26px]"
        aria-label="Recuperar contraseña"
      >
        <CampoTexto
          id="olvido-correo"
          etiqueta="Correo"
          Icono={Envelope}
          valor={correo}
          alCambiar={setCorreo}
          type="email"
          autoComplete="username"
          placeholder="correo@ejemplo.com"
        />
        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          Enviar instrucciones
        </button>
      </form>
      <div className="flex justify-center">
        <button type="button" className={ENLACE} onClick={irLogin}>
          Volver a iniciar sesión
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

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    setEnviado(false)
    if (!nombre.trim() || !correo.trim() || !clave || !clave2) {
      setError('Completa todos los campos.')
      return
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
      setError(
        `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`,
      )
      return
    }
    if (clave !== clave2) {
      setError('Las contraseñas no coinciden.')
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
          ? `No se pudo crear la cuenta: ${resultado.mensaje}.`
          : 'Revisa los datos que escribiste.',
      )
    } else {
      setError(MENSAJES_SIMPLES[resultado.motivo])
    }
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <p className="text-[17px] leading-normal text-tinta-suave">
        Llena tus datos. Un administrador del equipo revisará tu solicitud antes
        de activar la cuenta.
      </p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {enviado && (
        <Aviso tipo="exito">
          Solicitud enviada. Podrás entrar cuando un administrador la apruebe.
        </Aviso>
      )}
      <form
        onSubmit={enviar}
        noValidate
        className="flex flex-col gap-[22px]"
        aria-label="Crear cuenta"
      >
        <CampoTexto
          id="crear-nombre"
          etiqueta="Nombre completo"
          Icono={User}
          valor={nombre}
          alCambiar={setNombre}
          autoComplete="name"
          placeholder="Nombre y apellido"
        />
        <CampoTexto
          id="crear-correo"
          etiqueta="Correo"
          Icono={Envelope}
          valor={correo}
          alCambiar={setCorreo}
          type="email"
          autoComplete="email"
          placeholder="correo@ejemplo.com"
        />
        <CampoTexto
          id="crear-clave"
          etiqueta="Contraseña"
          Icono={Lock}
          valor={clave}
          alCambiar={setClave}
          type="password"
          autoComplete="new-password"
          placeholder={`Mínimo ${LARGO_MINIMO_CLAVE} caracteres`}
        />
        <CampoTexto
          id="crear-clave2"
          etiqueta="Repite la contraseña"
          Icono={Lock}
          valor={clave2}
          alCambiar={setClave2}
          type="password"
          autoComplete="new-password"
          placeholder="Escríbela otra vez"
        />
        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          Enviar solicitud
        </button>
      </form>
      <div className="flex justify-center">
        <button type="button" className={ENLACE} onClick={irLogin}>
          Ya tengo cuenta, volver a iniciar sesión
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

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cargando) return
    if (!clave || !clave2) {
      setError('Completa los dos campos.')
      return
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
      setError(
        `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`,
      )
      return
    }
    if (clave !== clave2) {
      setError('Las contraseñas no coinciden.')
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
      setError(
        'El enlace no es válido o ya caducó. Pide uno nuevo desde "¿Olvidaste tu contraseña?".',
      )
    } else {
      setError(MENSAJES_SIMPLES[resultado.motivo])
    }
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-[26px]">
        <Aviso tipo="exito">
          Tu contraseña se cambió. Ya puedes iniciar sesión.
        </Aviso>
        <button type="button" className={BOTON_PRINCIPAL} onClick={irLogin}>
          Ir a iniciar sesión
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
        aria-label="Restablecer contraseña"
      >
        <CampoTexto
          id="restablecer-clave"
          etiqueta="Contraseña nueva"
          Icono={Lock}
          valor={clave}
          alCambiar={setClave}
          type="password"
          autoComplete="new-password"
          placeholder={`Mínimo ${LARGO_MINIMO_CLAVE} caracteres`}
        />
        <CampoTexto
          id="restablecer-clave2"
          etiqueta="Repite la contraseña nueva"
          Icono={Lock}
          valor={clave2}
          alCambiar={setClave2}
          type="password"
          autoComplete="new-password"
          placeholder="Escríbela otra vez"
        />
        <button type="submit" className={BOTON_PRINCIPAL} disabled={cargando}>
          Cambiar contraseña
        </button>
      </form>
      <div className="flex justify-center">
        <button type="button" className={ENLACE} onClick={irLogin}>
          Volver a iniciar sesión
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
}: PaginaLoginProps) {
  const [vista, setVista] = useState<Vista>(
    tokenInicial ? 'restablecer' : 'login',
  )
  const { titulo, subtitulo } = ENCABEZADOS[vista]

  return (
    <div className="relative flex min-h-screen flex-wrap overflow-hidden bg-[#dbe8fd] bg-[linear-gradient(120deg,#b3cff9_0%,#dbe8fd_45%,#f6f9ff_100%)] font-sans text-tinta">
      <FondoOnda />

      <section className="relative z-10 flex min-w-0 flex-[1_1_520px] flex-col justify-between gap-9 px-6 py-12 sm:px-16">
        <div className="flex items-center gap-3">
          <ShieldCheck
            size={28}
            aria-hidden="true"
            className="text-[#174ea6]"
          />
          <span className="font-mono text-sm font-medium tracking-[0.08em] text-tinta">
            INTEGRACIÓN SEGURA OT-IT
          </span>
        </div>

        <div className="flex max-w-[480px] flex-col gap-[22px]">
          <h1 className="text-3xl leading-[1.15] font-bold tracking-tight text-tinta sm:text-[38px]">
            Del PLC a la nube, sin abrir la puerta equivocada.
          </h1>
          <p className="text-base leading-relaxed text-[#1d3a6b]">
            Panel de monitoreo de las variables de los PLC Siemens, enviadas de
            forma cifrada desde la red industrial.
          </p>
          <DiagramaFlujo />
        </div>

        <span className="font-mono text-xs font-medium text-tinta-suave">
          Reto de Concentración · Tec de Monterrey · Siemens
        </span>
      </section>

      <section className="relative z-10 flex min-w-0 flex-[1_1_600px] items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[540px] overflow-hidden rounded-[18px] border border-borde bg-white shadow-[0_18px_40px_rgba(11,47,107,0.2)]">
          <div className="flex items-center gap-4 border-b-4 border-turquesa bg-[linear-gradient(135deg,#0b2f6b_0%,#1f5fd0_100%)] px-6 py-[34px] sm:px-11">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] border border-white/40 bg-white/15">
              <WindowChartLine
                size={34}
                aria-hidden="true"
                className="text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-[26px] leading-tight font-bold text-white sm:text-[30px]">
                {titulo}
              </h2>
              <p className="text-base text-[#e3eeff]">{subtitulo}</p>
            </div>
          </div>

          <div className="px-6 pt-10 pb-11 sm:px-11">
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
          </div>
        </div>
      </section>
    </div>
  )
}
