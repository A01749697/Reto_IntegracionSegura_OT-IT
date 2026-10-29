// Lee las variables de entorno del panel y detiene el arranque si falta alguna obligatoria.
// Docker Compose las pasa desde el archivo .env del servidor.

export type ConexionBaseDatos = {
  host: string
  puerto: number
  usuario: string
  contrasena: string
  nombre: string
}

export type Entorno = {
  puerto: number
  urlPublica: string
  correoRemitente: string
  regionAws: string
  baseDatosLectura: ConexionBaseDatos
  baseDatosPanel: ConexionBaseDatos
}

function leerObligatoria(variables: NodeJS.ProcessEnv, nombre: string): string {
  const valor = variables[nombre]
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`)
  }
  return valor
}

// Devuelve solo el "origen" (por ejemplo https://18.119.219.73), sin diagonal final.
function leerUrlPublica(variables: NodeJS.ProcessEnv): string {
  const texto = leerObligatoria(variables, 'URL_PUBLICA')
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    throw new Error('URL_PUBLICA no es una dirección válida')
  }
  if (url.protocol !== 'https:') {
    throw new Error('URL_PUBLICA debe empezar con https://')
  }
  return url.origin
}

function leerCorreoRemitente(variables: NodeJS.ProcessEnv): string {
  const correo = leerObligatoria(variables, 'CORREO_REMITENTE')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
    throw new Error('CORREO_REMITENTE no es un correo válido')
  }
  return correo
}

export function leerEntorno(
  variables: NodeJS.ProcessEnv = process.env,
): Entorno {
  const puerto = Number(variables.PUERTO ?? 3002)
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error('PUERTO debe ser un número entre 1 y 65535')
  }

  const host = variables.DB_HOST ?? 'db'

  return {
    puerto,
    urlPublica: leerUrlPublica(variables),
    correoRemitente: leerCorreoRemitente(variables),
    regionAws: variables.AWS_REGION ?? 'us-east-2',
    baseDatosLectura: {
      host,
      puerto: 5432,
      usuario: 'reto_lectura',
      contrasena: leerObligatoria(variables, 'DB_READER_PASSWORD'),
      nombre: 'reto',
    },
    baseDatosPanel: {
      host,
      puerto: 5432,
      usuario: 'reto_panel',
      contrasena: leerObligatoria(variables, 'DB_PANEL_PASSWORD'),
      nombre: 'reto',
    },
  }
}
