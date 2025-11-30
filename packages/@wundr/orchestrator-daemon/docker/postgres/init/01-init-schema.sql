-- PostgreSQL initialization script for orchestrator-daemon
-- This script creates the necessary schema for session management,
-- monitoring, and federation features

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    agent_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    node_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    context JSONB DEFAULT '{}',
    error_message TEXT,
    INDEX idx_sessions_session_id (session_id),
    INDEX idx_sessions_status (status),
    INDEX idx_sessions_agent_type (agent_type),
    INDEX idx_sessions_created_at (created_at),
    INDEX idx_sessions_node_id (node_id)
);

-- ============================================================================
-- SESSION TASKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) REFERENCES sessions(session_id) ON DELETE CASCADE,
    task_id VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    result JSONB,
    error_message TEXT,
    INDEX idx_tasks_session_id (session_id),
    INDEX idx_tasks_task_id (task_id),
    INDEX idx_tasks_status (status)
);

-- ============================================================================
-- METRICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    node_id VARCHAR(100),
    metric_type VARCHAR(100) NOT NULL,
    metric_name VARCHAR(255) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    labels JSONB DEFAULT '{}',
    INDEX idx_metrics_timestamp (timestamp),
    INDEX idx_metrics_node_id (node_id),
    INDEX idx_metrics_type_name (metric_type, metric_name)
);

-- ============================================================================
-- COST TRACKING TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS cost_tracking (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES sessions(session_id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    model VARCHAR(100) NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
    INDEX idx_cost_session_id (session_id),
    INDEX idx_cost_timestamp (timestamp),
    INDEX idx_cost_model (model)
);

-- ============================================================================
-- FEDERATION NODES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS federation_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    capabilities JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_federation_node_id (node_id),
    INDEX idx_federation_status (status),
    INDEX idx_federation_last_heartbeat (last_heartbeat)
);

-- ============================================================================
-- MEMORY STORE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS memory_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(500) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    session_id VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_memory_key (key),
    INDEX idx_memory_session_id (session_id),
    INDEX idx_memory_expires_at (expires_at)
);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_store_updated_at BEFORE UPDATE ON memory_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up expired memory entries
CREATE OR REPLACE FUNCTION cleanup_expired_memory()
RETURNS void AS $$
BEGIN
    DELETE FROM memory_store
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old metrics (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM metrics
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Partial indexes for active sessions
CREATE INDEX idx_sessions_active ON sessions(session_id)
WHERE status IN ('pending', 'running');

-- Composite index for session queries
CREATE INDEX idx_sessions_status_created ON sessions(status, created_at DESC);

-- GIN index for JSONB metadata searches
CREATE INDEX idx_sessions_metadata_gin ON sessions USING GIN (metadata);
CREATE INDEX idx_memory_value_gin ON memory_store USING GIN (value);

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active sessions view
CREATE OR REPLACE VIEW active_sessions AS
SELECT
    session_id,
    agent_type,
    status,
    node_id,
    created_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) as duration_seconds
FROM sessions
WHERE status IN ('pending', 'running')
ORDER BY created_at DESC;

-- Session statistics view
CREATE OR REPLACE VIEW session_statistics AS
SELECT
    agent_type,
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, CURRENT_TIMESTAMP) - created_at))) as avg_duration_seconds
FROM sessions
GROUP BY agent_type, status;

-- Cost summary view
CREATE OR REPLACE VIEW cost_summary AS
SELECT
    DATE(timestamp) as date,
    model,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_cost) as total_cost
FROM cost_tracking
GROUP BY DATE(timestamp), model
ORDER BY date DESC, model;

-- ============================================================================
-- GRANTS (adjust based on your user setup)
-- ============================================================================

-- Grant permissions to the orchestrator user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO orchestrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO orchestrator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO orchestrator;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default federation node (self)
-- This will be updated by the daemon on startup
INSERT INTO federation_nodes (node_id, name, host, port, status, capabilities)
VALUES (
    'default-node',
    'Default Orchestrator Node',
    'localhost',
    8787,
    'active',
    '["session-management", "task-execution", "monitoring"]'::jsonb
) ON CONFLICT (node_id) DO NOTHING;

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

-- Create a function to run periodic maintenance
CREATE OR REPLACE FUNCTION run_maintenance()
RETURNS void AS $$
BEGIN
    PERFORM cleanup_expired_memory();
    PERFORM cleanup_old_metrics();
    -- Update statistics
    ANALYZE sessions;
    ANALYZE session_tasks;
    ANALYZE metrics;
    ANALYZE cost_tracking;
END;
$$ LANGUAGE plpgsql;

-- Comment the tables
COMMENT ON TABLE sessions IS 'Stores orchestrator session information';
COMMENT ON TABLE session_tasks IS 'Stores tasks associated with sessions';
COMMENT ON TABLE metrics IS 'Stores performance and monitoring metrics';
COMMENT ON TABLE cost_tracking IS 'Stores AI API usage and cost information';
COMMENT ON TABLE federation_nodes IS 'Stores information about federated orchestrator nodes';
COMMENT ON TABLE memory_store IS 'Stores session memory and shared state';
