-- =========================
-- USERS
-- =========================
CREATE TABLE newusers (
    serialno BIGSERIAL,
    user_id VARCHAR(20) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- TEAMS
-- =========================
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    team_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- TASKS (PERSONAL)
-- =========================
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    task TEXT NOT NULL,
    task_status BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tasks_user
    FOREIGN KEY (user_id)
    REFERENCES newusers(user_id)
    ON DELETE CASCADE
);

-- =========================
-- TEAM MEMBERS
-- =========================
CREATE TABLE team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER,
    user_id VARCHAR(20),
    role VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'member')),

    CONSTRAINT fk_team_members_team
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE CASCADE,

    CONSTRAINT fk_team_members_user
    FOREIGN KEY (user_id)
    REFERENCES newusers(user_id)
    ON DELETE CASCADE
);

-- =========================
-- TEAM TASKS
-- =========================
CREATE TABLE team_tasks (
    id SERIAL PRIMARY KEY,
    team_id INTEGER,
    task TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_team_tasks_team
    FOREIGN KEY (team_id)
    REFERENCES teams(id)
    ON DELETE CASCADE
);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    team_id INTEGER,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);