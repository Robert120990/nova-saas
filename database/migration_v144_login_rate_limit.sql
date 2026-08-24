-- v144: Rate-limit persistente de login
-- Tabla de contadores de intentos fallidos por (ip, username) con bloqueo temporal.
-- Reemplaza el Map en memoria de auth.routes.js para que los bloqueos
-- sobrevivan reinicios y puedan desbloquearse administrativamente.

CREATE TABLE IF NOT EXISTS login_rate_limits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    username VARCHAR(120) NOT NULL DEFAULT '',
    failed_attempts INT NOT NULL DEFAULT 0,
    window_start DATETIME NOT NULL,
    blocked_until DATETIME NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ip_user (ip, username),
    KEY idx_blocked_until (blocked_until),
    KEY idx_window_start (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
