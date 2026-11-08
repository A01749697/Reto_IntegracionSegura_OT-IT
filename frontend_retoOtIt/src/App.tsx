import { useCallback, useEffect, useState } from 'react'
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
import { obtenerEstado } from './panel/apiSistema'
import PaginaAdministracion from './panel/PaginaAdministracion'
import PaginaBitacora from './panel/PaginaBitacora'
import { descargarArchivo } from './panel/descarga'
import PaginaEstado from './panel/PaginaEstado'
import PaginaInicio from './panel/PaginaInicio'
import PaginaMiCuenta from './panel/PaginaMiCuenta'

// el enlace del correo trae #restablecer=CODIGO
function leerCodigoDelEnlace(): string | undefined {
  return /^#restablecer=([0-9a-f]{64})$/.exec(window.location.hash)?.[1]
}

type Pantalla = 'inicio' | 'cuentas' | 'bitacora' | 'estado' | 'cuenta'

function App() {
  const [codigo, setCodigo] = useState(leerCodigoDelEnlace)
  const [sesion, setSesion] = useState<Usuario | null | 'cargando'>('cargando')
  const [pantalla, setPantalla] = useState<Pantalla>('inicio')
  const alCaducarSesion = useCallback(() => {
    setPantalla('inicio')
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
        className="flex min-h-screen items-center justify-center bg-[#dbe8fd] font-sans text-tinta-suave"
      >
        Cargando...
      </p>
    )
  }

  if (sesion && pantalla === 'cuentas' && sesion.rol === 'administrador') {
    return (
      <PaginaAdministracion
        listar={listarCuentas}
        decidir={decidirCuenta}
        desbloquear={desbloquearCuenta}
        hacerAdministrador={hacerAdministrador}
        volver={() => setPantalla('inicio')}
        sesionCaducada={alCaducarSesion}
      />
    )
  }

  if (sesion && pantalla === 'bitacora' && sesion.rol === 'administrador') {
    return (
      <PaginaBitacora
        listar={listarBitacora}
        exportar={exportarBitacora}
        descargar={descargarArchivo}
        volver={() => setPantalla('inicio')}
        sesionCaducada={alCaducarSesion}
      />
    )
  }

  if (sesion && pantalla === 'estado') {
    return (
      <PaginaEstado
        obtener={obtenerEstado}
        volver={() => setPantalla('inicio')}
        sesionCaducada={alCaducarSesion}
      />
    )
  }

  if (sesion && pantalla === 'cuenta') {
    return (
      <PaginaMiCuenta
        usuario={sesion}
        cambiar={cambiarContrasena}
        volver={() => setPantalla('inicio')}
        sesionCaducada={alCaducarSesion}
      />
    )
  }

  if (sesion) {
    return (
      <PaginaInicio
        usuario={sesion}
        irCuentas={() => setPantalla('cuentas')}
        irBitacora={() => setPantalla('bitacora')}
        irEstado={() => setPantalla('estado')}
        irCuenta={() => setPantalla('cuenta')}
        cerrarSesion={async () => {
          const cerrada = await cerrarSesion()
          if (cerrada) alCaducarSesion()
          return cerrada
        }}
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
    />
  )
}

export default App
