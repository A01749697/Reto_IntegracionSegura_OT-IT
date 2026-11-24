-- =====================================================================
-- Historian del Reto Siemens OT-IT: estructura por estacion
-- Uso:  sudo -u postgres psql -f historian_nube.sql
-- Las contrasenas NO van en este archivo: asignalas despues con \password
--
-- Si el historian vive en el contenedor "db" del docker-compose (en lugar del
-- PostgreSQL del host), se ejecuta asi desde /opt/docker_retoOtIt:
--   sudo docker compose exec -T db psql -U reto_admin -d postgres -v ON_ERROR_STOP=1 < historian.sql
-- y las contrasenas se asignan con:
--   sudo docker compose exec db psql -U reto_admin -d historian -c "\password app_insert"
--   sudo docker compose exec db psql -U reto_admin -d historian -c "\password app_lectura"
-- Deben ser las mismas que DB_INGEST_PASSWORD (app_insert) y DB_READER_PASSWORD
-- (app_lectura) del archivo .env.
-- =====================================================================

-- ---------- Base de datos ----------
CREATE DATABASE historian;
\connect historian

-- ---------- Roles (login sin contrasena; se asigna aparte) ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_insert') THEN
    CREATE ROLE app_insert LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_lectura') THEN
    CREATE ROLE app_lectura LOGIN;
  END IF;
END$$;

-- Nadie mas puede crear objetos ni conectarse por defecto
REVOKE ALL ON DATABASE historian FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE historian TO app_insert, app_lectura;
GRANT USAGE ON SCHEMA public TO app_insert, app_lectura;

-- ---------- Tablas por estacion (misma estructura que el historian de la IDMZ) ----------
-- ts_pi : hora en que el historian guarda la fila
-- ts_plc: hora en que el colector recibio el dato
-- nodo  : nombre del nodo OPC UA
-- valor : valor como texto (True, 4, 0.0, ...)

CREATE TABLE telemetria_300 (
    ts_pi  timestamptz NOT NULL DEFAULT now(),
    ts_plc timestamptz,
    nodo   text        NOT NULL,
    valor  text        NOT NULL
);
COMMENT ON TABLE telemetria_300 IS 'Estacion Amatrol con S7-300 (CPU 314C): 43 nodos';

CREATE TABLE telemetria_1500 (
    ts_pi  timestamptz NOT NULL DEFAULT now(),
    ts_plc timestamptz,
    nodo   text        NOT NULL,
    valor  text        NOT NULL
);
COMMENT ON TABLE telemetria_1500 IS 'Tablero neumatico en S7-1516: nodos TAB_* y LATIDO';

CREATE TABLE telemetria_1200 (
    ts_pi  timestamptz NOT NULL DEFAULT now(),
    ts_plc timestamptz,
    nodo   text        NOT NULL,
    valor  text        NOT NULL
);
COMMENT ON TABLE telemetria_1200 IS 'Torreta y eventos del S7-1200 (reservada)';

-- ---------- Indices para consultar por nodo y tiempo ----------
CREATE INDEX ix_tel300_nodo_ts  ON telemetria_300  (nodo, ts_plc DESC);
CREATE INDEX ix_tel1500_nodo_ts ON telemetria_1500 (nodo, ts_plc DESC);
CREATE INDEX ix_tel1200_nodo_ts ON telemetria_1200 (nodo, ts_plc DESC);

-- ---------- Vista que une las tres tablas, con la estacion ----------
CREATE VIEW telemetria_todas AS
    SELECT '300'  AS estacion, ts_pi, ts_plc, nodo, valor FROM telemetria_300
    UNION ALL
    SELECT '1500' AS estacion, ts_pi, ts_plc, nodo, valor FROM telemetria_1500
    UNION ALL
    SELECT '1200' AS estacion, ts_pi, ts_plc, nodo, valor FROM telemetria_1200;

-- ---------- Permisos (minimo privilegio) ----------
GRANT INSERT ON telemetria_300, telemetria_1500, telemetria_1200 TO app_insert;
GRANT SELECT ON telemetria_300, telemetria_1500, telemetria_1200, telemetria_todas TO app_lectura;

-- ---------- Siguiente paso, a mano ----------
-- \password app_insert
-- \password app_lectura
