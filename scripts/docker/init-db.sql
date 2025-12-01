-- =============================================================================
-- Wundr Development Database Initialization
-- =============================================================================
-- This script runs automatically when PostgreSQL container starts for the first time.
-- It creates additional databases needed for the monorepo packages.
-- =============================================================================

-- Create additional databases for different services
CREATE DATABASE orchestrator;
CREATE DATABASE genesis;

-- Grant privileges to the main user
GRANT ALL PRIVILEGES ON DATABASE orchestrator TO neolith;
GRANT ALL PRIVILEGES ON DATABASE genesis TO neolith;

-- Enable required extensions
\c neolith
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c orchestrator
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\c genesis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Log completion
\echo '✅ Database initialization complete'
\echo '   - neolith (primary)'
\echo '   - orchestrator'
\echo '   - genesis'
