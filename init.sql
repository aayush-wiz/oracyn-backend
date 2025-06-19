-- Initialize Oracyn Database
-- This script sets up the database with necessary extensions and configurations
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "citext";

-- Create custom types if needed
-- DO $$ BEGIN
--     CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
-- EXCEPTION
--     WHEN duplicate_object THEN null;
-- END $$;
-- Create indexes for better performance (Prisma will handle this, but keeping for reference)
-- These will be created by Prisma migrations
-- Create functions for common operations
CREATE
OR REPLACE FUNCTION updated_at_trigger() RETURNS TRIGGER AS $ $ BEGIN NEW.updated_at = CURRENT_TIMESTAMP;

RETURN NEW;

END;

$ $ language 'plpgsql';

-- Set up database configuration for optimal performance
ALTER SYSTEM
SET
    shared_preload_libraries = 'pg_stat_statements';

ALTER SYSTEM
SET
    track_activity_query_size = 2048;

ALTER SYSTEM
SET
    log_min_duration_statement = 1000;

-- Log slow queries
-- Reload configuration
SELECT
    pg_reload_conf();

-- Grant necessary permissions to the oracyn_user
GRANT ALL PRIVILEGES ON DATABASE oracyn_db TO oracyn_user;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO oracyn_user;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO oracyn_user;

GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO oracyn_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO oracyn_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO oracyn_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO oracyn_user;

-- Create a schema for application-specific functions (optional)
-- CREATE SCHEMA IF NOT EXISTS oracyn_functions;
-- GRANT ALL PRIVILEGES ON SCHEMA oracyn_functions TO oracyn_user;