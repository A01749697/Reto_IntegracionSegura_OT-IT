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
  // dónde preguntar si la API receptora está viva (dentro de la red de Docker)
  urlApiReceptora: string
  // archivo del certificado público de nginx, montado en solo lectura
  rutaCertificado: string
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

// Solo se acepta http o https. Se devuelve el origen, sin diagonal final.
function leerUrlApiReceptora(variables: NodeJS.ProcessEnv): string {
  const texto = variables.URL_API_RECEPTORA ?? 'http://api-ingest:3001'
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    throw new Error('URL_API_RECEPTORA no es una dirección válida')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL_API_RECEPTORA debe empezar con http:// o https://')
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
  // El historian puede estar en otro lado (PostgreSQL del host u otro servidor).
  // Si no se indica, se usa la misma base del panel.
  const hostHistorian = variables.HISTORIAN_HOST || host
  const puertoHistorian = Number(variables.HISTORIAN_PORT ?? 5432)
  if (
    !Number.isInteger(puertoHistorian) ||
    puertoHistorian < 1 ||
    puertoHistorian > 65535
  ) {
    throw new Error('HISTORIAN_PORT debe ser un número entre 1 y 65535')
  }

  return {
    puerto,
    urlPublica: leerUrlPublica(variables),
    correoRemitente: leerCorreoRemitente(variables),
    regionAws: variables.AWS_REGION ?? 'us-east-2',
    urlApiReceptora: leerUrlApiReceptora(variables),
    rutaCertificado: variables.RUTA_CERTIFICADO || '/certs-servidor/reto.crt',
    // Base "historian": el rol app_lectura solo puede hacer SELECT.
    baseDatosLectura: {
      host: hostHistorian,
      puerto: puertoHistorian,
      usuario: 'app_lectura',
      contrasena: leerObligatoria(variables, 'DB_READER_PASSWORD'),
      nombre: 'historian',
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
