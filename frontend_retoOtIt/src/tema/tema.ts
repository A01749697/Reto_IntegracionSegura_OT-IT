export type Tema = 'oscuro' | 'claro'

const CLAVE = 'tema'

const esTema = (valor: unknown): valor is Tema =>
  valor === 'claro' || valor === 'oscuro'

function temaGuardado(): Tema | null {
  try {
    const valor = localStorage.getItem(CLAVE)
    return esTema(valor) ? valor : null
  } catch {
    return null
  }
}

function temaDelSistema(): Tema {
  const claro =
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-color-scheme: light)').matches
  return claro ? 'claro' : 'oscuro'
}

// El script de index.html ya lo fijo en <html>; esto cubre cuando no corrio.
export function temaActual(): Tema {
  const puesto = document.documentElement.dataset.tema
  if (esTema(puesto)) return puesto
  return temaGuardado() ?? temaDelSistema()
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema
  try {
    localStorage.setItem(CLAVE, tema)
  } catch {
    // sin almacenamiento solo se pierde que se acuerde de la eleccion
  }
}
