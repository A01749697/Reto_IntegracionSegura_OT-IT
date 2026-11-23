import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import FondoOnda from './comun/FondoOnda'
import { obtenerUltimasLecturas } from './gemelo/apiLecturas'
import PaginaGemelo from './gemelo/PaginaGemelo'
import FranjaZonas from './comun/FranjaZonas'
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
import {
  obtenerDisponibilidad,
  obtenerEstado,
  obtenerServidor,
} from './panel/apiSistema'
import EncabezadoPanel, { type Seccion } from './panel/EncabezadoPanel'
import PaginaAdministracion from './panel/PaginaAdministracion'
import PaginaAyuda from './panel/PaginaAyuda'
import PaginaBitacora from './panel/PaginaBitacora'
import PaginaDatos from './panel/PaginaDatos'
import { descargarArchivo } from './panel/descarga'
import PaginaEstado from './panel/PaginaEstado'
import PaginaInicio from './panel/PaginaInicio'
import PaginaMiCuenta from './panel/PaginaMiCuenta'
import PaginaNoEncontrada from './rutas/PaginaNoEncontrada'
import { destinoDeSeccion, RAIZ } from './rutas/rutas'
import { useDestino } from './rutas/useDestino'

// el enlace del correo trae #restablecer=CODIGO
function leerCodigoDelEnlace(): string | undefined {
  return /^#restablecer=([0-9a-f]{64})$/.exec(window.location.hash)?.[1]
}

const LOGIN = { donde: 'publica', pagina: 'login' } as const
const CREAR = { donde: 'publica', pagina: 'crear' } as const

function Contenido() {
  const { t } = useTranslation()
  const [codigo, setCodigo] = useState(leerCodigoDelEnlace)
  const [sesion, setSesion] = useState<Usuario | null | 'cargando'>('cargando')
  // la pantalla actual sale de la direccion del navegador
  const [destino, navegar] = useDestino()

  const irA = useCallback(
    (seccion: Seccion) => navegar(destinoDeSeccion(seccion)),
    [navegar],
  )

  // la sesion se vencio: se vuelve al login
  const alCaducarSesion = useCallback(() => {
    navegar(LOGIN, { reemplazar: true })
    setSesion(null)
  }, [navegar])

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

  async function cerrar() {
    const cerrada = await cerrarSesion()
    if (cerrada) {
      navegar(RAIZ, { reemplazar: true })
      setSesion(null)
    }
    return cerrada
  }

  if (sesion === 'cargando') {
    return (
      <p
        role="status"
        className="flex min-h-screen items-center justify-center font-sans text-suave"
      >
        {t('general.cargando')}
      </p>
    )
  }

  if (destino.donde === 'desconocida') {
    const pagina = <PaginaNoEncontrada irAlInicio={() => navegar(RAIZ)} />
    // con sesion se conserva el encabezado para poder seguir navegando
    if (!sesion) {
      return (
        <div className="min-h-screen font-sans text-texto">
          <FranjaZonas />
          {pagina}
        </div>
      )
    }
    return (
      <div className="min-h-screen font-sans text-texto">
        <EncabezadoPanel
          usuario={sesion}
          actual={null}
          irA={irA}
          cerrarSesion={cerrar}
        />
        {pagina}
      </div>
    )
  }

  if (!sesion) {
    // con el enlace del correo se entra directo al formulario, sin pasar por la portada
    if (destino.donde === 'raiz' && !codigo) {
      return (
        <PaginaLanding
          irLogin={() => navegar(LOGIN)}
          irCrear={() => navegar(CREAR)}
        />
      )
    }
    const vista =
      destino.donde === 'publica' && destino.pagina === 'crear'
        ? 'crear'
        : 'login'
    return (
      <PaginaLogin
        // al cambiar de direccion (Atras, Adelante) se arma de nuevo con su vista
        key={vista}
        autenticar={entrar}
        solicitarCuenta={crearCuenta}
        recuperarClave={pedirReinicio}
        restablecerClave={restablecer}
        alIniciarSesion={(usuario) => {
          setCodigo(undefined)
          // quien venia a una pantalla del panel llega a ella; los demas, al inicio
          if (destino.donde !== 'panel') navegar(RAIZ, { reemplazar: true })
          setSesion(usuario)
        }}
        tokenInicial={codigo}
        vistaInicial={vista}
        alVolver={() => {
          setCodigo(undefined)
          navegar(RAIZ)
        }}
      />
    )
  }

  const esAdmin = sesion.rol === 'administrador'
  const pedida: Seccion = destino.donde === 'panel' ? destino.seccion : 'inicio'
  // si alguien sin permiso llega a una pantalla de administracion, ve el inicio
  const seccion: Seccion =
    (pedida === 'cuentas' || pedida === 'bitacora' || pedida === 'datos') &&
    !esAdmin
      ? 'inicio'
      : pedida

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
      <PaginaEstado
        obtener={obtenerEstado}
        obtenerDisponibilidad={obtenerDisponibilidad}
        obtenerServidor={esAdmin ? obtenerServidor : undefined}
        sesionCaducada={alCaducarSesion}
      />
    )
  } else if (seccion === 'gemelo') {
    contenido = (
      <PaginaGemelo
        obtenerLecturas={obtenerUltimasLecturas}
        sesionCaducada={alCaducarSesion}
      />
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
    contenido = (
      <PaginaInicio
        usuario={sesion}
        obtenerEstado={obtenerEstado}
        listarPendientes={listarPendientes}
        listarEventos={listarEventosRecientes}
        irA={irA}
        sesionCaducada={alCaducarSesion}
      />
    )
  }

  return (
    <div className="min-h-screen font-sans text-texto">
      <EncabezadoPanel
        usuario={sesion}
        actual={seccion}
        irA={irA}
        cerrarSesion={cerrar}
      />
      {contenido}
    </div>
  )
}

// fuera del componente para que no cambien en cada pintada
const listarPendientes = () => listarCuentas('pendiente')
const listarEventosRecientes = () => listarBitacora('todos')

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
