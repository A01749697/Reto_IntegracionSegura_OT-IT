import { useState, type FormEvent, type ReactNode } from 'react'
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
import BotonTema from '../tema/BotonTema'
import CampoTexto from './CampoTexto'
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
  /** Con que formulario abre cuando viene de la pagina de inicio. */
  vistaInicial?: 'login' | 'crear'
  /** Si viene, el nombre del panel lleva de vuelta a la pagina de inicio. */
  alVolver?: () => void
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

const BOTON_PRINCIPAL = `${boton('principal', 'grande')} w-full`
const BOTON_SECUNDARIO = `${boton('contorno', 'grande')} w-full`
const ENLACE =
  'cursor-pointer rounded px-1 py-3 text-[13px] font-medium text-acento underline underline-offset-[3px] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento'

const ENCABEZADOS: Record<Vista, { titulo: string; subtitulo: string }> = {
  login: {
    titulo: 'Entrar al panel',
    subtitulo: 'Supervisa la comunicación segura entre la planta y la nube.',
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
        <div className="h-px grow bg-linea" />
        <span className="text-[13px] text-suave">¿Aún no tienes cuenta?</span>
        <div className="h-px grow bg-linea" />
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
      <p className="text-[14px] leading-normal text-suave">
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
      <p className="text-[14px] leading-normal text-suave">
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
  vistaInicial,
  alVolver,
}: PaginaLoginProps) {
  const [vista, setVista] = useState<Vista>(
    tokenInicial ? 'restablecer' : (vistaInicial ?? 'login'),
  )
  const { titulo, subtitulo } = ENCABEZADOS[vista]
  const marca = 'text-base font-bold tracking-tight'

  return (
    <div className="flex min-h-screen flex-col font-sans text-texto">
      <FranjaZonas />
      <header className="mx-auto flex h-[60px] w-full max-w-[1040px] items-center justify-between px-4 sm:px-7">
        {alVolver ? (
          <button
            type="button"
            onClick={alVolver}
            aria-label="Panel Reto OT-IT, ir al inicio"
            className={`${marca} cursor-pointer rounded focus-visible:ring-[3px] focus-visible:ring-acento/45 focus-visible:outline-none`}
          >
            Panel Reto OT-IT
          </button>
        ) : (
          <span className={marca}>Panel Reto OT-IT</span>
        )}
        <BotonTema />
      </header>

      <main className="mx-auto flex w-full max-w-[460px] flex-1 flex-col gap-8 px-4 pt-6 pb-12 sm:px-0">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">
            {titulo}
          </h1>
          <p className="mt-2 text-[13.5px] text-suave">{subtitulo}</p>
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
