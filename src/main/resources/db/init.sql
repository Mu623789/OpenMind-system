CREATE DATABASE IF NOT EXISTS cpt208_discussion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cpt208_discussion;

SET @session_participants_exists = (
    SELECT COUNT(*)
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'cpt208_discussion'
      AND TABLE_NAME = 'session_participants'
);

SET @session_participants_unique_exists = (
    SELECT COUNT(*)
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = 'cpt208_discussion'
      AND TABLE_NAME = 'session_participants'
      AND INDEX_NAME = 'uk_session_participant_session_user'
);

SET @session_participants_unique_sql = IF(
    @session_participants_exists > 0 AND @session_participants_unique_exists = 0,
    'ALTER TABLE session_participants ADD CONSTRAINT uk_session_participant_session_user UNIQUE (session_id, user_id)',
    'SELECT 1'
);

PREPARE session_participants_unique_stmt FROM @session_participants_unique_sql;
EXECUTE session_participants_unique_stmt;
DEALLOCATE PREPARE session_participants_unique_stmt;
