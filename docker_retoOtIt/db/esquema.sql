-- Esquema de la base de datos "reto" (PostgreSQL 18).
--
-- Describe lo que ya existe en el servidor: la tabla de lecturas, sus reglas
-- de validacion y los dos roles con permisos minimos.
-- Se puede ejecutar varias veces sin romper nada (no borra ni duplica).
--
-- Para recrear la base en un servidor nuevo, con el contenedor "db" corriendo,
-- primero se copia este archivo al servidor y despues se ejecuta alli:
--
--   cd /opt/docker_retoOtIt
--   sudo docker compose exec -T db psql -U reto_admin -d reto -v ON_ERROR_STOP=1 < esquema.sql
--
-- Este archivo NO guarda contrasenas. Despues de ejecutarlo hay que asignarlas
-- con ALTER ROLE, usando los valores del archivo .env del servidor:
--
--   ALTER ROLE reto_insercion PASSWORD '<DB_INGEST_PASSWORD>';
--   ALTER ROLE reto_lectura   PASSWORD '<DB_READER_PASSWORD>';

-- Roles ---------------------------------------------------------------------
-- reto_insercion: lo usa la API receptora. Solo puede insertar lecturas.
-- reto_lectura:   lo usara la API del panel. Solo puede leer lecturas.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reto_insercion') THEN
    CREATE ROLE reto_insercion LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reto_lectura') THEN
    CREATE ROLE reto_lectura LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Tabla de lecturas ---------------------------------------------------------
-- Una fila por cada valor que manda el agente de IT.
-- Las reglas CHECK son la segunda barrera: la primera es la validacion de la API.

CREATE TABLE IF NOT EXISTS public.lecturas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts          timestamptz NOT NULL,                  -- momento en que el PLC midio el valor
  recibido_en timestamptz NOT NULL DEFAULT now(),    -- momento en que llego a la nube
  plc         text NOT NULL,
  variable    text NOT NULL,
  valor       double precision NOT NULL,
  CONSTRAINT lecturas_plc_largo
    CHECK (char_length(plc) BETWEEN 1 AND 20),
  CONSTRAINT lecturas_variable_formato
    CHECK (variable ~ '^[a-z][a-z0-9_]{0,63}$'),
  CONSTRAINT lecturas_valor_rango
    CHECK (valor BETWEEN -1e12 AND 1e12)
);

-- Para consultar el historial de una variable ordenado por fecha.
CREATE INDEX IF NOT EXISTS lecturas_variable_ts_idx
  ON public.lecturas (variable, ts);

-- Permisos ------------------------------------------------------------------

GRANT INSERT ON TABLE public.lecturas TO reto_insercion;
GRANT SELECT ON TABLE public.lecturas TO reto_lectura;
