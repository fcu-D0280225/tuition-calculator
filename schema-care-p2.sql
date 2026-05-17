-- ── Care Module P2 Schema ──────────────────────────────────────────────────
-- 這些表在 P1 驗證使用率後再執行。目前僅存檔備用，不執行。

-- 通知單
CREATE TABLE IF NOT EXISTS care_notices (
  id           VARCHAR(64)  NOT NULL,
  tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
  title        VARCHAR(255) NOT NULL,
  content      TEXT         NOT NULL,
  target       ENUM('all','class') NOT NULL DEFAULT 'all',
  target_class VARCHAR(64)  NOT NULL DEFAULT '',
  published_at DATETIME     DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_notices_tenant (tenant_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 成長記錄
CREATE TABLE IF NOT EXISTS care_growth (
  id          VARCHAR(64)  NOT NULL,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  student_id  VARCHAR(64)  NOT NULL,
  record_date DATE         NOT NULL,
  category    VARCHAR(64)  NOT NULL DEFAULT 'general',
  content     TEXT         NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_growth_student (student_id, record_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 體溫紀錄
CREATE TABLE IF NOT EXISTS care_temperature (
  id          VARCHAR(64)  NOT NULL,
  tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
  student_id  VARCHAR(64)  NOT NULL,
  measured_at DATETIME     NOT NULL,
  temperature DECIMAL(4,1) NOT NULL,
  session     ENUM('morning','noon','afternoon') NOT NULL DEFAULT 'morning',
  note        VARCHAR(255) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  INDEX idx_care_temp_student (student_id, measured_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 託藥單
CREATE TABLE IF NOT EXISTS care_medications (
  id            VARCHAR(64)  NOT NULL,
  tenant_id     INT UNSIGNED NOT NULL DEFAULT 1,
  student_id    VARCHAR(64)  NOT NULL,
  med_date      DATE         NOT NULL,
  drug_name     VARCHAR(255) NOT NULL,
  dosage        VARCHAR(128) NOT NULL,
  times_per_day INT          NOT NULL DEFAULT 1,
  note          VARCHAR(255) NOT NULL DEFAULT '',
  given_at      DATETIME     DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_care_med_student_date (student_id, med_date)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
