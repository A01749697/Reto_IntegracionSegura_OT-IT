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
import { decidirCuenta, listarCuentas } from './panel/apiAdministracion'
import PaginaAdministracion from './panel/PaginaAdministracion'
import PaginaInicio from './panel/PaginaInicio'

// el enlace del correo trae #restablecer=CODIGO
function leerCodigoDelEnlace(): string | undefined {
  return /^#restablecer=([0-9a-f]{64})$/.exec(window.location.hash)?.[1]
}

function App() {
  const [codigo, setCodigo] = useState(leerCodigoDelEnlace)
  const [sesion, setSesion] = useState<Usuario | null | 'cargando'>('cargando')
  const [verCuentas, setVerCuentas] = useState(false)
  const alCaducarSesion = useCallback(() => {
    setVerCuentas(false)
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

  if (sesion && verCuentas && sesion.rol === 'administrador') {
    return (
      <PaginaAdministracion
        listar={listarCuentas}
        decidir={decidirCuenta}
        volver={() => setVerCuentas(false)}
        sesionCaducada={alCaducarSesion}
      />
    )
  }

  if (sesion) {
    return (
      <PaginaInicio
        usuario={sesion}
        irCuentas={() => setVerCuentas(true)}
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
