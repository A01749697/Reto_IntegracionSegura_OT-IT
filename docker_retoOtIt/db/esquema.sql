-- Esquema de la base de datos "reto" (PostgreSQL 18).
--
-- Describe lo que ya existe en el servidor: la tabla de lecturas, sus reglas
-- de validacion, las tablas del panel (usuarios, enlaces de reinicio y
-- sesiones) y los roles con permisos minimos.
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
--   ALTER ROLE reto_panel     PASSWORD '<DB_PANEL_PASSWORD>';

-- Roles ---------------------------------------------------------------------
-- reto_insercion: lo usa la API receptora. Solo puede insertar lecturas.
-- reto_lectura:   lo usa la API del panel. Solo puede leer lecturas.
-- reto_panel:     lo usa la API del panel. Maneja cuentas, enlaces y sesiones
--                 (se crea mas abajo, en la parte del panel).

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

-- ============================================================
-- Panel: usuarios, enlaces de reinicio y sesiones
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre            text NOT NULL,
  correo            text NOT NULL,
  contrasena_hash   text NOT NULL,
  rol               text NOT NULL DEFAULT 'usuario',
  estado            text NOT NULL DEFAULT 'pendiente',
  intentos_fallidos integer NOT NULL DEFAULT 0,
  bloqueado_hasta   timestamptz,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  aprobado_en       timestamptz,
  aprobado_por      bigint REFERENCES usuarios (id),
  CONSTRAINT usuarios_nombre_largo CHECK (char_length(nombre) BETWEEN 1 AND 100),
  CONSTRAINT usuarios_correo_formato CHECK (
    correo = lower(correo)
    AND char_length(correo) <= 254
    AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT usuarios_rol_valido CHECK (rol IN ('usuario', 'administrador')),
  CONSTRAINT usuarios_estado_valido CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_correo_idx ON usuarios (correo);

CREATE TABLE IF NOT EXISTS enlaces_reinicio (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  bigint NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  expira_en   timestamptz NOT NULL,
  usado_en    timestamptz
);

CREATE INDEX IF NOT EXISTS enlaces_reinicio_usuario_idx ON enlaces_reinicio (usuario_id);

CREATE TABLE IF NOT EXISTS sesiones (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id     bigint NOT NULL REFERENCES usuarios (id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  expira_en      timestamptz NOT NULL,
  ultimo_uso_en  timestamptz NOT NULL DEFAULT now(),
  revocada_en    timestamptz
);

CREATE INDEX IF NOT EXISTS sesiones_usuario_idx ON sesiones (usuario_id);

-- Rol del panel (la contraseña se asigna aparte con ALTER ROLE)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reto_panel') THEN
    CREATE ROLE reto_panel LOGIN;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON usuarios, enlaces_reinicio, sesiones TO reto_panel;
GRANT USAGE ON SEQUENCE usuarios_id_seq, enlaces_reinicio_id_seq, sesiones_id_seq TO reto_panel;
