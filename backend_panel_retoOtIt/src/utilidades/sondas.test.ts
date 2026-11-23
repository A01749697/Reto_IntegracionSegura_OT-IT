import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  comprobarApiReceptora,
  leerCpu,
  leerDisco,
  leerMemoria,
  leerVencimientoCertificado,
} from './sondas'

// Certificado de prueba, solo la parte pública (sin llave privada). Vence en 2126.
const CERTIFICADO = `-----BEGIN CERTIFICATE-----
MIIDETCCAfmgAwIBAgIUJTjB9be1weUYMi/uPHTz+vL+OUswDQYJKoZIhvcNAQEL
BQAwFzEVMBMGA1UEAwwMcHJ1ZWJhLmxvY2FsMCAXDTI2MTEyMzA1MTM0NloYDzIx
MjYxMDMwMDUxMzQ2WjAXMRUwEwYDVQQDDAxwcnVlYmEubG9jYWwwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQDpGmGxyoWdJNbT0Q2fZW+6slcxBSTyVGzp
RvG8e5SbpxDSu4b9n3dFbagNeR561Zb/Usg6xhWl9vpdLnWlicy7gb3PLylHY14R
oTTRXYR6Hk5sdbExdA/csBUY4z5FIV5mI+anfxbpHiu94jSLub4GR+lSCbvnwnGr
NYQCGP4WHNwWRaW8PM9FssFpMv+AgtfvzZhu4nJ0geXWcXa1GGUfxteyqb/PbGlU
O8RbF01ZZ7ecZGYlPcfrwZZhlV6kNkUD6UJChMhjEN+Qo9R9uC0vHQzl2lcMVIFu
e5tjlbMdZjJgysMndG19A8MhhaYfe8fSFaFc2JrwqCBm/H/oaXVtAgMBAAGjUzBR
MB0GA1UdDgQWBBTImh0M/pia7nd3xSxPi2bs6iE0gzAfBgNVHSMEGDAWgBTImh0M
/pia7nd3xSxPi2bs6iE0gzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQALeNNhRjASIWLu1/th03v6Hro9xD5vQpMkp0ZeHPDx2mZPSQFruxR0CDA3
t8PGJzLRdsSsa0hhpxgn3Ll+ld01jLjPocpxuvSxSVlMFq8xsUhGWDGwfsWlOVVN
GJk7WPuhyoaCa+vawmSPx9hXFFG6zK3nHLW75uewcLeltpTVKNzxOzOz//1kIUgh
acG5ZMsHheStRDop09ZZHrZbsZ0F58oM5R7rwDiGr+KsYGEhO8RinD8uYfHDiQaG
OB5Tq9I921jKTtpc5d59yAYtEtWk+6qKFLMvda0XsniDT6Rl1yZJ9X9ub2iI4Yf1
kD/UkFZtm5r56IH5Lb6zs4Y6TWFH
-----END CERTIFICATE-----
`

const MEMINFO = `MemTotal:        2000000 kB
MemAvailable:     800000 kB
SwapTotal:       1000000 kB
SwapFree:         900000 kB
`

let carpeta = ''

beforeEach(async () => {
  carpeta = await mkdtemp(path.join(os.tmpdir(), 'sondas-'))
})

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

describe('leerDisco', () => {
  it('regresa un total mayor a cero y un usado que cabe en el total', async () => {
    const disco = await leerDisco(carpeta)
    expect(disco.totalBytes).toBeGreaterThan(0)
    expect(disco.usadoBytes).toBeGreaterThanOrEqual(0)
    expect(disco.usadoBytes).toBeLessThanOrEqual(disco.totalBytes)
  })

  it('falla si la ruta no existe', async () => {
    await expect(leerDisco(path.join(carpeta, 'no-existe'))).rejects.toThrow()
  })
})

describe('leerMemoria', () => {
  it('lee un archivo con formato de meminfo', async () => {
    const ruta = path.join(carpeta, 'meminfo')
    await writeFile(ruta, MEMINFO)
    expect(await leerMemoria(ruta)).toEqual({
      totalBytes: 2000000 * 1024,
      disponibleBytes: 800000 * 1024,
      swapTotalBytes: 1000000 * 1024,
      swapUsadoBytes: 100000 * 1024,
    })
  })

  it('falla si el archivo no se puede interpretar', async () => {
    const ruta = path.join(carpeta, 'meminfo')
    await writeFile(ruta, 'basura')
    await expect(leerMemoria(ruta)).rejects.toThrow(
      'No se pudo interpretar la memoria',
    )
  })
})

describe('leerCpu', () => {
  it('regresa al menos un núcleo y cargas sin negativos', () => {
    const cpu = leerCpu()
    expect(cpu.nucleos).toBeGreaterThanOrEqual(1)
    expect(cpu.carga1).toBeGreaterThanOrEqual(0)
    expect(cpu.carga5).toBeGreaterThanOrEqual(0)
    expect(cpu.carga15).toBeGreaterThanOrEqual(0)
  })
})

describe('leerVencimientoCertificado', () => {
  it('regresa la fecha en que vence el certificado', async () => {
    const ruta = path.join(carpeta, 'reto.crt')
    await writeFile(ruta, CERTIFICADO)
    const vence = await leerVencimientoCertificado(ruta)
    expect(vence.toISOString()).toBe('2126-10-30T05:13:46.000Z')
  })

  it('falla si el archivo no existe o no es un certificado', async () => {
    await expect(
      leerVencimientoCertificado(path.join(carpeta, 'no-existe.crt')),
    ).rejects.toThrow()
    const ruta = path.join(carpeta, 'malo.crt')
    await writeFile(ruta, 'no soy un certificado')
    await expect(leerVencimientoCertificado(ruta)).rejects.toThrow()
  })
})

describe('comprobarApiReceptora', () => {
  let servidor: Server | undefined

  afterEach(async () => {
    await new Promise<void>((resolver) => {
      if (!servidor) return resolver()
      servidor.close(() => resolver())
      servidor.closeAllConnections()
    })
    servidor = undefined
  })

  async function levantar(
    manejar: Parameters<typeof createServer>[1] & object,
  ): Promise<string> {
    servidor = createServer(manejar)
    await new Promise<void>((resolver) =>
      servidor?.listen(0, '127.0.0.1', resolver),
    )
    const { port } = servidor.address() as AddressInfo
    return `http://127.0.0.1:${port}`
  }

  it('acepta una API que responde ok', async () => {
    let ruta = ''
    const url = await levantar((req, res) => {
      ruta = req.url ?? ''
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ estado: 'ok' }))
    })
    await expect(comprobarApiReceptora(url, 1000)).resolves.toBeUndefined()
    expect(ruta).toBe('/api/ingest/salud')
  })

  it('falla si responde con error', async () => {
    const url = await levantar((_req, res) => {
      res.statusCode = 503
      res.end('{}')
    })
    await expect(comprobarApiReceptora(url, 1000)).rejects.toThrow('503')
  })

  it('falla si responde 200 pero no dice ok', async () => {
    const url = await levantar((_req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ estado: 'mal' }))
    })
    await expect(comprobarApiReceptora(url, 1000)).rejects.toThrow('no dijo ok')
  })

  it('falla si tarda más de lo permitido', async () => {
    const url = await levantar(() => {
      // nunca responde
    })
    await expect(comprobarApiReceptora(url, 100)).rejects.toThrow()
  })

  it('no sigue redirecciones', async () => {
    const url = await levantar((_req, res) => {
      res.statusCode = 302
      res.setHeader('Location', 'http://127.0.0.1:1/')
      res.end()
    })
    await expect(comprobarApiReceptora(url, 1000)).rejects.toThrow()
  })

  it('falla si nadie escucha', async () => {
    await expect(
      comprobarApiReceptora('http://127.0.0.1:1', 1000),
    ).rejects.toThrow()
  })
})
