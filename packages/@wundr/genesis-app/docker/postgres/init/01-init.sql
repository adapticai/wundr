-- =============================================================================
-- Genesis-App PostgreSQL Initialization Script
-- =============================================================================
-- This script runs automatically when the PostgreSQL container is first created.
-- It sets up extensions and initial database configuration.
-- =============================================================================

-- Enable useful extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "citext";         -- Case-insensitive text

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS genesis;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set default search path
ALTER DATABASE genesis_db SET search_path TO genesis, public;

-- Grant privileges
GRANT ALL PRIVILEGES ON SCHEMA genesis TO genesis;
GRANT ALL PRIVILEGES ON SCHEMA audit TO genesis;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Genesis-App database initialization complete';
END $$;
