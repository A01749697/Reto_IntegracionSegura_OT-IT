// Lee y escribe cookies sin instalar una librería extra.

// Busca una cookie por su nombre exacto en la cabecera Cookie. Devuelve undefined si no está.
export function leerCookie(
  cabecera: string | undefined,
  nombre: string,
): string | undefined {
  if (!cabecera) return undefined
  for (const parte of cabecera.split(';')) {
    const posicion = parte.indexOf('=')
    if (posicion === -1) continue
    if (parte.slice(0, posicion).trim() === nombre) {
      return parte.slice(posicion + 1).trim()
    }
  }
  return undefined
}

// HttpOnly: JavaScript no la puede leer (frena el robo por XSS).
// Secure: solo viaja por HTTPS.
// SameSite=Strict: el navegador no la manda en peticiones que vienen de otros sitios.
// Path=/ y sin Domain: requisitos del prefijo __Host- (la cookie queda atada a este sitio).
const ATRIBUTOS = 'Path=/; HttpOnly; Secure; SameSite=Strict'

// El valor es un código hexadecimal, por eso no necesita codificarse.
export function crearCookieSesion(
  nombre: string,
  valor: string,
  duracionSegundos: number,
): string {
  return `${nombre}=${valor}; Max-Age=${duracionSegundos}; ${ATRIBUTOS}`
}

// Le dice al navegador que borre la cookie.
export function crearCookieBorrada(nombre: string): string {
  return `${nombre}=; Max-Age=0; ${ATRIBUTOS}`
}
