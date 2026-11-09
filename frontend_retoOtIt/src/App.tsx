import { useCallback, useEffect, useState, type ReactNode } from 'react'
import FondoOnda from './comun/FondoOnda'
import PaginaLanding from './landing/PaginaLanding'
import {
  cerrarSesion,
  crearCuenta,
  entrar,
  obtenerSesion,
  pedirReinicio,
  restablecer,
  type Usuario,
} from './login/apiPanel'
import PaginaLogin from './login/PaginaLogin'
import {
  decidirCuenta,
  desbloquearCuenta,
  hacerAdministrador,
  listarCuentas,
} from './panel/apiAdministracion'
import { exportarBitacora, listarBitacora } from './panel/apiBitacora'
import { cambiarContrasena } from './panel/apiCuenta'
import { leerDatos, listarTablas } from './panel/apiDatos'
import { obtenerEstado } from './panel/apiSistema'
import EncabezadoPanel, { type Seccion } from './panel/EncabezadoPanel'
import PaginaAdministracion from './panel/PaginaAdministracion'
import PaginaAyuda from './panel/PaginaAyuda'
import PaginaBitacora from './panel/PaginaBitacora'
import PaginaDatos from './panel/PaginaDatos'
import { descargarArchivo } from './panel/descarga'
import PaginaEstado from './panel/PaginaEstado'
import PaginaInicio from './panel/PaginaInicio'
import PaginaMiCuenta from './panel/PaginaMiCuenta'

// el enlace del correo trae #restablecer=CODIGO
function leerCodigoDelEnlace(): string | undefined {
  return /^#restablecer=([0-9a-f]{64})$/.exec(window.location.hash)?.[1]
}

// Lo que se ve sin sesion.
type Publica = 'landing' | 'login' | 'crear'

function Contenido() {
  const [codigo, setCodigo] = useState(leerCodigoDelEnlace)
  const [sesion, setSesion] = useState<Usuario | null | 'cargando'>('cargando')
  const [pantalla, setPantalla] = useState<Seccion>('inicio')
  // con el enlace del correo se entra directo al formulario, sin pasar por la landing
  const [publica, setPublica] = useState<Publica>(() =>
    leerCodigoDelEnlace() ? 'login' : 'landing',
  )

  // la sesion se vencio: se vuelve al login
  const alCaducarSesion = useCallback(() => {
    setPantalla('inicio')
    setPublica('login')
    setSesion(null)
  }, [])

  useEffect(() => {
    // lo quito de la barra para que no se quede en el historial
    if (codigo) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }
  }, [codigo])

  useEffect(() => {
    let vigente = true
    obtenerSesion().then((usuario) => {
      if (vigente) setSesion(usuario)
    })
    return () => {
      vigente = false
    }
  }, [])

  if (sesion === 'cargando') {
    return (
      <p
        role="status"
        className="flex min-h-screen items-center justify-center font-sans text-suave"
      >
        Cargando...
      </p>
    )
  }

  if (!sesion) {
    if (publica === 'landing') {
      return (
        <PaginaLanding
          irLogin={() => setPublica('login')}
          irCrear={() => setPublica('crear')}
        />
      )
    }
    return (
      <PaginaLogin
        autenticar={entrar}
        solicitarCuenta={crearCuenta}
        recuperarClave={pedirReinicio}
        restablecerClave={restablecer}
        alIniciarSesion={(usuario) => {
          setCodigo(undefined)
          setSesion(usuario)
        }}
        tokenInicial={codigo}
        vistaInicial={publica === 'crear' ? 'crear' : 'login'}
        alVolver={() => setPublica('landing')}
      />
    )
  }

  const esAdmin = sesion.rol === 'administrador'
  // si alguien sin permiso llega a una pantalla de administracion, ve el inicio
  const seccion: Seccion =
    (pantalla === 'cuentas' ||
      pantalla === 'bitacora' ||
      pantalla === 'datos') &&
    !esAdmin
      ? 'inicio'
      : pantalla

  let contenido: ReactNode
  if (seccion === 'cuentas') {
    contenido = (
      <PaginaAdministracion
        listar={listarCuentas}
        decidir={decidirCuenta}
        desbloquear={desbloquearCuenta}
        hacerAdministrador={hacerAdministrador}
        sesionCaducada={alCaducarSesion}
      />
    )
  } else if (seccion === 'bitacora') {
    contenido = (
      <PaginaBitacora
        listar={listarBitacora}
        exportar={exportarBitacora}
        descargar={descargarArchivo}
        sesionCaducada={alCaducarSesion}
      />
    )
  } else if (seccion === 'datos') {
    contenido = (
      <PaginaDatos
        listarTablas={listarTablas}
        leer={leerDatos}
        sesionCaducada={alCaducarSesion}
      />
    )
  } else if (seccion === 'estado') {
    contenido = (
      <PaginaEstado obtener={obtenerEstado} sesionCaducada={alCaducarSesion} />
    )
  } else if (seccion === 'ayuda') {
    contenido = <PaginaAyuda esAdmin={esAdmin} />
  } else if (seccion === 'cuenta') {
    contenido = (
      <PaginaMiCuenta
        usuario={sesion}
        cambiar={cambiarContrasena}
        sesionCaducada={alCaducarSesion}
      />
    )
  } else {
    contenido = <PaginaInicio usuario={sesion} />
  }

  return (
    <div className="min-h-screen font-sans text-texto">
      <EncabezadoPanel
        usuario={sesion}
        actual={seccion}
        irA={setPantalla}
        cerrarSesion={async () => {
          const cerrada = await cerrarSesion()
          if (cerrada) {
            setPantalla('inicio')
            setPublica('landing')
            setSesion(null)
          }
          return cerrada
        }}
      />
      {contenido}
    </div>
  )
}

// El fondo de onda va detras de todas las pantallas.
function App() {
  return (
    <>
      <FondoOnda />
      <Contenido />
    </>
  )
}

export default App
