// Lee las variables de entorno y detiene el arranque si falta alguna obligatoria.
// Docker Compose las pasa desde el archivo .env del servidor.

export type Entorno = {
  puerto: number
  tokenIngesta: string
  baseDatos: {
    host: string
    puerto: number
    usuario: string
    contrasena: string
    nombre: string
  }
}

function leerObligatoria(variables: NodeJS.ProcessEnv, nombre: string): string {
  const valor = variables[nombre]
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`)
  }
  return valor
}

export function leerEntorno(
  variables: NodeJS.ProcessEnv = process.env,
): Entorno {
  const tokenIngesta = leerObligatoria(variables, 'API_INGEST_TOKEN')
  if (tokenIngesta.length < 32) {
    throw new Error('API_INGEST_TOKEN debe tener al menos 32 caracteres')
  }

  const puerto = Number(variables.PUERTO ?? 3001)
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error('PUERTO debe ser un número entre 1 y 65535')
  }

  return {
    puerto,
    tokenIngesta,
    baseDatos: {
      host: variables.DB_HOST ?? 'db',
      puerto: 5432,
      usuario: 'reto_insercion',
      contrasena: leerObligatoria(variables, 'DB_INGEST_PASSWORD'),
      nombre: 'reto',
    },
  }
}
