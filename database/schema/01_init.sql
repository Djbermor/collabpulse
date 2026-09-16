-- ==============================================================================
-- COLLABPULSE ENTERPRISE PLATFORM - POSTGRESQL 16+ INITIALIZATION
-- Script: 01_init.sql
-- Extensions, schemas and shared trigger functions
-- ==============================================================================

-- 1. Extensions required for Cryptography, Full Text Search & Trigram Matching
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. Generic function to update updated_at timestamp in UTC
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CLOCK_TIMESTAMP();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Immutable unaccent text search dictionary configuration for multitenant search
CREATE OR REPLACE FUNCTION collabpulse_tsvector(text_content TEXT)
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('simple', COALESCE(unaccent(text_content), ''));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
