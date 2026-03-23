-- =============================================================================
-- Cria usuário e banco para o .env padrão do Ativa Dash (dev local no Windows).
-- Rode como superusuário do Postgres (normalmente o usuário "postgres").
--
-- PowerShell (ajuste o caminho do psql se precisar):
--   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -f scripts/setup-local-postgres.sql
--
-- Ou: abra pgAdmin → Query Tool (como postgres) → cole e execute.
-- =============================================================================

-- Usuário ativadash (senha igual ao docker-compose e ao backend/.env de exemplo)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ativadash') THEN
    CREATE ROLE ativadash LOGIN PASSWORD 'ativadash_local_dev';
  ELSE
    ALTER ROLE ativadash WITH PASSWORD 'ativadash_local_dev';
  END IF;
END
$$;

-- Banco (erro "already exists" = pode ignorar; o importante é existir e ser do ativadash)
CREATE DATABASE ativa_dash OWNER ativadash;

-- Permissões no schema public (PostgreSQL 15+)
\connect ativa_dash
GRANT ALL ON SCHEMA public TO ativadash;
GRANT CREATE ON SCHEMA public TO ativadash;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ativadash;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ativadash;
