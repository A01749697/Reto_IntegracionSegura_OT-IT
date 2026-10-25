import PaginaLogin from './login/PaginaLogin'
import {
  autenticarTemporal,
  recuperarClaveTemporal,
  solicitarCuentaTemporal,
} from './login/apiTemporal'

function App() {
  return (
    <PaginaLogin
      autenticar={autenticarTemporal}
      solicitarCuenta={solicitarCuentaTemporal}
      recuperarClave={recuperarClaveTemporal}
    />
  )
}

export default App
