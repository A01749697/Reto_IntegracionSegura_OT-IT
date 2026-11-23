import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { TARJETA } from '../comun/estilos'
import type { RecursosServidor, ResultadoServidor } from './apiSistema'
import { bytes, porcentaje } from './formato'
import { fechaCorta } from './tiempo'

type Props = {
  obtener: () => Promise<ResultadoServidor>
  sesionCaducada: () => void
  // sube cada vez que se pulsa "Actualizar" en la pantalla de Estado
  recarga: number
}

// Desde este porcentaje la barra pasa a color de alerta.
const LIMITE_USO = 80
// Con menos días que estos, el certificado se marca como por vencer.
const DIAS_AVISO = 30

type Carga = { recarga: number; resultado: ResultadoServidor }

function Barra({ nombre, valor }: { nombre: string; valor: number }) {
  const alto = valor >= LIMITE_USO
  return (
    <div
      role="progressbar"
      aria-label={nombre}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={valor}
      className="h-2 w-full overflow-hidden rounded-full bg-linea"
    >
      <div
        className={`h-full ${alto ? 'bg-alerta' : 'bg-ok'}`}
        style={{ width: `${valor}%` }}
      />
    </div>
  )
}

function Medida({
  nombre,
  valor,
  detalle,
  alerta = false,
  barra,
}: {
  nombre: string
  valor: string
  detalle?: string
  alerta?: boolean
  barra?: number
}) {
  return (
    <div className={`${TARJETA} flex flex-col gap-2 px-5 py-4`}>
      <p className="text-[13px] font-semibold text-suave">{nombre}</p>
      <p
        className={`text-[20px] font-bold ${alerta ? 'text-alerta' : 'text-texto'}`}
      >
        {valor}
      </p>
      {barra !== undefined && <Barra nombre={nombre} valor={barra} />}
      {detalle && <p className="text-[12.5px] text-suave">{detalle}</p>}
    </div>
  )
}

function NoDisponible({ nombre, t }: { nombre: string; t: TFunction }) {
  return (
    <Medida
      nombre={nombre}
      valor={t('estado.servidor.noDisponible')}
      alerta
      detalle={t('estado.servidor.noSePudoLeer')}
    />
  )
}

function Servicio({
  nombre,
  parte,
  t,
}: {
  nombre: string
  parte: 'ok' | 'falla'
  t: TFunction
}) {
  return (
    <Medida
      nombre={nombre}
      valor={parte === 'ok' ? t('estado.responde') : t('estado.noResponde')}
      alerta={parte === 'falla'}
    />
  )
}

function Medidas({
  recursos,
  t,
}: {
  recursos: RecursosServidor
  t: TFunction
}) {
  const { disco, memoria, cpu, baseDatos, certificado, servicios } = recursos

  const usoDisco = disco ? porcentaje(disco.usadoBytes, disco.totalBytes) : 0
  const memoriaUsada = memoria
    ? memoria.totalBytes - memoria.disponibleBytes
    : 0
  const usoMemoria = memoria ? porcentaje(memoriaUsada, memoria.totalBytes) : 0
  const usoSwap = memoria
    ? porcentaje(memoria.swapUsadoBytes, memoria.swapTotalBytes)
    : 0
  // Con un núcleo, una carga sostenida arriba de 1 quiere decir que el procesador anda corto.
  const cargaPorNucleo = cpu ? cpu.carga5 / cpu.nucleos : 0

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {disco ? (
        <Medida
          nombre={t('estado.servidor.disco.nombre')}
          valor={`${usoDisco} %`}
          barra={usoDisco}
          alerta={usoDisco >= LIMITE_USO}
          detalle={t('estado.servidor.disco.detalle', {
            usado: bytes(disco.usadoBytes),
            total: bytes(disco.totalBytes),
          })}
        />
      ) : (
        <NoDisponible nombre={t('estado.servidor.disco.nombre')} t={t} />
      )}

      {memoria ? (
        <Medida
          nombre={t('estado.servidor.memoria.nombre')}
          valor={`${usoMemoria} %`}
          barra={usoMemoria}
          alerta={usoMemoria >= LIMITE_USO}
          detalle={t('estado.servidor.memoria.detalle', {
            usada: bytes(memoriaUsada),
            total: bytes(memoria.totalBytes),
          })}
        />
      ) : (
        <NoDisponible nombre={t('estado.servidor.memoria.nombre')} t={t} />
      )}

      {memoria ? (
        memoria.swapTotalBytes === 0 ? (
          <Medida
            nombre={t('estado.servidor.swap.nombre')}
            valor={t('estado.servidor.swap.sinSwap')}
            detalle={t('estado.servidor.swap.sinSwapDetalle')}
          />
        ) : (
          <Medida
            nombre={t('estado.servidor.swap.nombre')}
            valor={`${usoSwap} %`}
            barra={usoSwap}
            alerta={usoSwap >= LIMITE_USO}
            detalle={t('estado.servidor.swap.detalle', {
              usada: bytes(memoria.swapUsadoBytes),
              total: bytes(memoria.swapTotalBytes),
            })}
          />
        )
      ) : (
        <NoDisponible nombre={t('estado.servidor.swap.nombre')} t={t} />
      )}

      {cpu ? (
        <Medida
          nombre={t('estado.servidor.cpu.nombre')}
          valor={t('estado.servidor.cpu.valor', { carga: cpu.carga5 })}
          alerta={cargaPorNucleo >= 1}
          detalle={t('estado.servidor.cpu.detalle', {
            carga1: cpu.carga1,
            carga15: cpu.carga15,
            count: cpu.nucleos,
          })}
        />
      ) : (
        <NoDisponible nombre={t('estado.servidor.cpu.nombre')} t={t} />
      )}

      {baseDatos ? (
        <Medida
          nombre={t('estado.servidor.baseDatos.nombre')}
          valor={bytes(baseDatos.totalBytes)}
          detalle={t('estado.servidor.baseDatos.detalle', {
            lecturas: bytes(baseDatos.lecturasBytes),
          })}
        />
      ) : (
        <NoDisponible nombre={t('estado.servidor.baseDatos.nombre')} t={t} />
      )}

      {certificado ? (
        <Medida
          nombre={t('estado.servidor.certificado.nombre')}
          valor={
            certificado.diasRestantes < 0
              ? t('estado.servidor.certificado.vencido')
              : t('estado.servidor.certificado.dias', {
                  count: certificado.diasRestantes,
                })
          }
          alerta={certificado.diasRestantes < DIAS_AVISO}
          detalle={t('estado.servidor.certificado.detalle', {
            fecha: fechaCorta(certificado.venceEn),
          })}
        />
      ) : (
        <NoDisponible nombre={t('estado.servidor.certificado.nombre')} t={t} />
      )}

      <Servicio
        nombre={t('estado.servidor.servicios.baseDatosPanel')}
        parte={servicios.baseDatosPanel}
        t={t}
      />
      <Servicio
        nombre={t('estado.servidor.servicios.baseDatosLecturas')}
        parte={servicios.baseDatosLecturas}
        t={t}
      />
      <Servicio
        nombre={t('estado.servidor.servicios.apiReceptora')}
        parte={servicios.apiReceptora}
        t={t}
      />
    </div>
  )
}

// Salud del servidor en la nube. Solo la ve un administrador.
export default function SeccionServidor({
  obtener,
  sesionCaducada,
  recarga,
}: Props) {
  const { t } = useTranslation()
  const [carga, setCarga] = useState<Carga | null>(null)

  useEffect(() => {
    let vigente = true
    obtener().then((resultado) => {
      if (!vigente) return
      if (!resultado.ok && resultado.motivo === 'sesion') sesionCaducada()
      else setCarga({ recarga, resultado })
    })
    return () => {
      vigente = false
    }
  }, [obtener, recarga, sesionCaducada])

  const cargando = carga === null || carga.recarga !== recarga
  const recursos =
    !cargando && carga.resultado.ok ? carga.resultado.recursos : null

  return (
    <section aria-labelledby="titulo-servidor" className="flex flex-col gap-3">
      <div>
        <h2 id="titulo-servidor" className="text-[16px] font-bold">
          {t('estado.servidor.titulo')}
        </h2>
        <p className="text-[12.5px] text-suave">
          {t('estado.servidor.subtitulo')}
        </p>
      </div>

      {cargando && (
        <p className="text-suave">{t('estado.servidor.cargando')}</p>
      )}

      {!cargando && !recursos && (
        <p role="alert" className="text-[14px] text-alerta">
          {t('estado.servidor.error')}
        </p>
      )}

      {recursos && (
        <>
          <Medidas recursos={recursos} t={t} />
          <p className="text-[12.5px] text-suave">
            {t('estado.servidor.nota')}
          </p>
        </>
      )}
    </section>
  )
}
