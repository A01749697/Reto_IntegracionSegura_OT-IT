export const IDIOMAS = ['es', 'en'] as const
export type Idioma = (typeof IDIOMAS)[number]

const CLAVE = 'idioma'

export const esIdioma = (valor: unknown): valor is Idioma =>
  IDIOMAS.some((idioma) => idioma === valor)

export function idiomaGuardado(): Idioma | null {
  try {
    const valor = localStorage.getItem(CLAVE)
    return esIdioma(valor) ? valor : null
  } catch {
    return null
  }
}

export function guardarIdioma(idioma: Idioma): void {
  try {
    localStorage.setItem(CLAVE, idioma)
  } catch {
    // sin almacenamiento, el idioma solo dura mientras la pagina esta abierta
  }
}

export function idiomaDelNavegador(): Idioma | null {
  const lista = navigator.languages?.length
    ? navigator.languages
    : [navigator.language]
  for (const completo of lista) {
    const base = completo.slice(0, 2).toLowerCase()
    if (esIdioma(base)) return base
  }
  return null
}

// Primero lo que eligio la persona, luego el idioma del navegador y al final español.
export const idiomaInicial = (): Idioma =>
  idiomaGuardado() ?? idiomaDelNavegador() ?? 'es'
