-- ============================================================================
--  Tuition Calculator — Database Schema
--  目的：在新環境部屬時，建立完整資料庫結構
--  用法：
--      mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS tuition_calculator
--                            CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--      mysql -u root -p tuition_calculator < schema.sql
--
--  備註：
--   - 此檔為 server/db.js 中 initSchema() 累積到目前為止的最終狀態
--   - 啟動 `npm run server` 也會自動執行 initSchema()，新環境兩種方式擇一即可
--   - 字元集統一 utf8mb4 / utf8mb4_unicode_ci（支援繁體中文）
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 0. Tenants（多租戶主表，FEAT-012） ─────────────────────────────────────
-- 所有領域表都帶 tenant_id 欄位指回此表；新環境預設建立 id=1「預設補習班」。
-- 各領域表的 tenant_id 欄位、INDEX、FK 透過檔尾的 ALTER TABLE 區塊統一加上。
DROP TABLE IF EXISTS `tenants`;
CREATE TABLE `tenants` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(128) NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `tenants` (`id`, `name`) VALUES (1, '預設補習班');

-- ── 1. 學生 ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `students`;
CREATE TABLE `students` (
  `id`            VARCHAR(64)  NOT NULL,
  `name`          VARCHAR(128) NOT NULL,
  `school`        VARCHAR(128) NOT NULL DEFAULT '',
  `grade`         VARCHAR(32)  NOT NULL DEFAULT '',
  `contact_name`  VARCHAR(128) NOT NULL DEFAULT '',
  `contact_phone` VARCHAR(64)  NOT NULL DEFAULT '',
  `sort_order`    INT          NOT NULL DEFAULT 0,
  `active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_students_name` (`name`),
  INDEX `idx_students_active` (`active`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 2. 教師 ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `teachers`;
CREATE TABLE `teachers` (
  `id`            VARCHAR(64)  NOT NULL,
  `name`          VARCHAR(128) NOT NULL,
  `contact_phone` VARCHAR(64)  NOT NULL DEFAULT '',
  `sort_order`    INT          NOT NULL DEFAULT 0,
  `active`        TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_teachers_name` (`name`),
  INDEX `idx_teachers_active` (`active`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 3. 家教課程 ─────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `courses`;
CREATE TABLE `courses` (
  `id`                    VARCHAR(64)    NOT NULL,
  `name`                  VARCHAR(128)   NOT NULL,
  `hourly_rate`           DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `teacher_hourly_rate`   DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `discount_per_student`  DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `default_teacher_id`    VARCHAR(64)    NULL DEFAULT NULL,
  `duration_hours`        DECIMAL(4,2)   NOT NULL DEFAULT 1,
  `note`                  VARCHAR(256)   NOT NULL DEFAULT '',
  `sort_order`            INT            NOT NULL DEFAULT 0,
  `created_at`            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_courses_name` (`name`),
  CONSTRAINT `fk_courses_default_teacher`
    FOREIGN KEY (`default_teacher_id`) REFERENCES `teachers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 4. 上課紀錄 ─────────────────────────────────────────────────────────────
-- status: pending（待點名） / attended（已點名） / pre_enroll（報名前自動補的）
DROP TABLE IF EXISTS `lesson_records`;
CREATE TABLE `lesson_records` (
  `id`                  VARCHAR(64)    NOT NULL,
  `student_id`          VARCHAR(64)    NOT NULL,
  `course_id`           VARCHAR(64)    NOT NULL,
  `teacher_id`          VARCHAR(64)    NULL DEFAULT NULL,
  `hours`               DECIMAL(5,2)   NOT NULL,
  `lesson_date`         DATE           NOT NULL,
  `start_time`          TIME           NULL DEFAULT NULL,
  `unit_price`          DECIMAL(10,2)  NULL DEFAULT NULL,
  `teacher_unit_price`  DECIMAL(10,2)  NULL DEFAULT NULL,
  `note`                VARCHAR(256)   NOT NULL DEFAULT '',
  `status`              VARCHAR(16)    NOT NULL DEFAULT 'attended',
  `from_enroll_batch`   TINYINT(1)     NOT NULL DEFAULT 0,
  `created_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_lesson_date`    (`lesson_date`),
  INDEX `idx_lesson_student` (`student_id`, `lesson_date`),
  INDEX `idx_lesson_teacher` (`teacher_id`, `lesson_date`),
  CONSTRAINT `fk_lesson_student`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_lesson_course`
    FOREIGN KEY (`course_id`)  REFERENCES `courses`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_lesson_teacher`
    FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 5. 教材 ─────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `materials`;
CREATE TABLE `materials` (
  `id`         VARCHAR(64)   NOT NULL,
  `name`       VARCHAR(128)  NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_materials_name` (`name`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 6. 教材銷售紀錄 ─────────────────────────────────────────────────────────
-- unit_price 採 snapshot：售出當下價格固定，避免改價回溯舊帳
DROP TABLE IF EXISTS `material_records`;
CREATE TABLE `material_records` (
  `id`          VARCHAR(64)    NOT NULL,
  `student_id`  VARCHAR(64)    NOT NULL,
  `material_id` VARCHAR(64)    NOT NULL,
  `quantity`    DECIMAL(8,2)   NOT NULL DEFAULT 1,
  `unit_price`  DECIMAL(10,2)  NULL DEFAULT NULL,
  `record_date` DATE           NOT NULL,
  `note`        VARCHAR(256)   NOT NULL DEFAULT '',
  `created_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_mr_date`    (`record_date`),
  INDEX `idx_mr_student` (`student_id`, `record_date`),
  CONSTRAINT `fk_mr_student`
    FOREIGN KEY (`student_id`)  REFERENCES `students`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_mr_material`
    FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 7. 團體課（groups） ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `id`                   VARCHAR(64)    NOT NULL,
  `name`                 VARCHAR(128)   NOT NULL,
  `weekdays`             VARCHAR(15)    NOT NULL DEFAULT '',
  `duration_months`      TINYINT        NOT NULL DEFAULT 0,
  `monthly_fee`          DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `start_time`           TIME           NULL DEFAULT NULL,
  `duration_hours`       DECIMAL(4,2)   NOT NULL DEFAULT 0,
  `teacher_hourly_rate`  DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `salary_type`          ENUM('hourly','monthly') NOT NULL DEFAULT 'hourly',
  `monthly_salary`       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `default_teacher_id`   VARCHAR(64)    NULL DEFAULT NULL,
  `sort_order`           INT            NOT NULL DEFAULT 0,
  `note`                 VARCHAR(256)   NOT NULL DEFAULT '',
  `created_at`           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_groups_name` (`name`),
  CONSTRAINT `fk_groups_default_teacher`
    FOREIGN KEY (`default_teacher_id`) REFERENCES `teachers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 8. 團課報名（學生 ↔ 團課） ──────────────────────────────────────────────
DROP TABLE IF EXISTS `group_members`;
CREATE TABLE `group_members` (
  `group_id`   VARCHAR(64) NOT NULL,
  `student_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`group_id`, `student_id`),
  INDEX `idx_gm_student` (`student_id`),
  CONSTRAINT `fk_gm_group`
    FOREIGN KEY (`group_id`)   REFERENCES `groups`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_gm_student`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 9. 團課點名紀錄 ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `group_records`;
CREATE TABLE `group_records` (
  `id`          VARCHAR(64)   NOT NULL,
  `group_id`    VARCHAR(64)   NOT NULL,
  `student_id`  VARCHAR(64)   NOT NULL,
  `teacher_id`  VARCHAR(64)   NULL DEFAULT NULL,
  `record_date` DATE          NOT NULL,
  `note`        VARCHAR(256)  NOT NULL DEFAULT '',
  `status`      VARCHAR(16)   NOT NULL DEFAULT 'attended',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_gr_date`    (`record_date`),
  INDEX `idx_gr_group`   (`group_id`,   `record_date`),
  INDEX `idx_gr_student` (`student_id`, `record_date`),
  INDEX `idx_gr_teacher` (`teacher_id`, `record_date`),
  CONSTRAINT `fk_gr_group`
    FOREIGN KEY (`group_id`)   REFERENCES `groups`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_gr_student`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gr_teacher`
    FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 10. 雜項支出（房租／水電／行銷／其他） ─────────────────────────────────
DROP TABLE IF EXISTS `misc_expenses`;
CREATE TABLE `misc_expenses` (
  `id`           VARCHAR(64)    NOT NULL,
  `name`         VARCHAR(128)   NOT NULL,
  `category`     VARCHAR(32)    NOT NULL DEFAULT '其他',
  `amount`       DECIMAL(10,2)  NOT NULL DEFAULT 0,
  `expense_date` DATE           NOT NULL,
  `note`         VARCHAR(256)   NOT NULL DEFAULT '',
  `created_at`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_misc_date`     (`expense_date`),
  INDEX `idx_misc_category` (`category`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 11. 學生 ↔ 家教課報名表 ────────────────────────────────────────────────
DROP TABLE IF EXISTS `student_courses`;
CREATE TABLE `student_courses` (
  `student_id` VARCHAR(64) NOT NULL,
  `course_id`  VARCHAR(64) NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`, `course_id`),
  INDEX `idx_sc_course` (`course_id`),
  CONSTRAINT `fk_sc_student`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sc_course`
    FOREIGN KEY (`course_id`)  REFERENCES `courses`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 12. 結算期間鎖（鎖定後不允許動該段期間的紀錄） ─────────────────────────
DROP TABLE IF EXISTS `period_locks`;
CREATE TABLE `period_locks` (
  `id`          VARCHAR(64)  NOT NULL,
  `period_from` DATE         NOT NULL,
  `period_to`   DATE         NOT NULL,
  `note`        VARCHAR(256) NOT NULL DEFAULT '',
  `locked_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_lock_period` (`period_from`, `period_to`)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 13. 家長分享連結 token ─────────────────────────────────────────────────
DROP TABLE IF EXISTS `share_tokens`;
CREATE TABLE `share_tokens` (
  `id`          VARCHAR(64)  NOT NULL,
  `token`       VARCHAR(64)  NOT NULL,
  `student_id`  VARCHAR(64)  NOT NULL,
  `period_from` DATE         NOT NULL,
  `period_to`   DATE         NOT NULL,
  `expires_at`  DATETIME     NOT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_share_tokens_token` (`token`),
  INDEX `idx_share_tokens_token` (`token`),
  CONSTRAINT `fk_share_tokens_student`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 14. 收款紀錄 ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `payment_records`;
CREATE TABLE `payment_records` (
  `id`          VARCHAR(64)   NOT NULL,
  `student_id`  VARCHAR(64)   NOT NULL,
  `period_from` DATE          NOT NULL,
  `period_to`   DATE          NOT NULL,
  `paid_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `note`        VARCHAR(256)  NOT NULL DEFAULT '',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_payment` (`student_id`, `period_from`, `period_to`),
  INDEX `idx_payment_period` (`period_from`, `period_to`),
  CONSTRAINT `fk_payment_student`
    FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 15. 請假紀錄 ───────────────────────────────────────────────────────────
DROP TABLE IF EXISTS `leave_requests`;
CREATE TABLE `leave_requests` (
  `id`               VARCHAR(64)   NOT NULL,
  `student_id`       VARCHAR(64)   NOT NULL,
  `course_id`        VARCHAR(64)   NOT NULL,
  `lesson_record_id` VARCHAR(64)   NULL DEFAULT NULL,
  `leave_date`       DATE          NOT NULL,
  `reason`           VARCHAR(512)  NOT NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_leave_student` (`student_id`, `leave_date`),
  INDEX `idx_leave_date`    (`leave_date`),
  INDEX `idx_leave_lesson`  (`lesson_record_id`),
  CONSTRAINT `fk_leave_student`
    FOREIGN KEY (`student_id`)       REFERENCES `students`(`id`)       ON DELETE CASCADE,
  CONSTRAINT `fk_leave_course`
    FOREIGN KEY (`course_id`)        REFERENCES `courses`(`id`)        ON DELETE CASCADE,
  CONSTRAINT `fk_leave_lesson`
    FOREIGN KEY (`lesson_record_id`) REFERENCES `lesson_records`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── 16. 多租戶欄位（FEAT-012 Step 1） ─────────────────────────────────────
-- 每張領域表加 tenant_id 欄位（NOT NULL DEFAULT 1），INDEX 與 FK 指向 tenants。
ALTER TABLE `students`         ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_students_tenant`         (`tenant_id`), ADD CONSTRAINT `fk_students_tenant`         FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `teachers`         ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_teachers_tenant`         (`tenant_id`), ADD CONSTRAINT `fk_teachers_tenant`         FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `courses`          ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_courses_tenant`          (`tenant_id`), ADD CONSTRAINT `fk_courses_tenant`          FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `lesson_records`   ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_lesson_records_tenant`   (`tenant_id`), ADD CONSTRAINT `fk_lesson_records_tenant`   FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `materials`        ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_materials_tenant`        (`tenant_id`), ADD CONSTRAINT `fk_materials_tenant`        FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `material_records` ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_material_records_tenant` (`tenant_id`), ADD CONSTRAINT `fk_material_records_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `groups`           ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_groups_tenant`           (`tenant_id`), ADD CONSTRAINT `fk_groups_tenant`           FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `group_members`    ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_group_members_tenant`    (`tenant_id`), ADD CONSTRAINT `fk_group_members_tenant`    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `group_records`    ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_group_records_tenant`    (`tenant_id`), ADD CONSTRAINT `fk_group_records_tenant`    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `misc_expenses`    ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_misc_expenses_tenant`    (`tenant_id`), ADD CONSTRAINT `fk_misc_expenses_tenant`    FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `student_courses`  ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_student_courses_tenant`  (`tenant_id`), ADD CONSTRAINT `fk_student_courses_tenant`  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `period_locks`     ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_period_locks_tenant`     (`tenant_id`), ADD CONSTRAINT `fk_period_locks_tenant`     FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `share_tokens`     ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_share_tokens_tenant`     (`tenant_id`), ADD CONSTRAINT `fk_share_tokens_tenant`     FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `payment_records`  ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_payment_records_tenant`  (`tenant_id`), ADD CONSTRAINT `fk_payment_records_tenant`  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;
ALTER TABLE `leave_requests`   ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1, ADD INDEX `idx_leave_requests_tenant`   (`tenant_id`), ADD CONSTRAINT `fk_leave_requests_tenant`   FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT;

SET FOREIGN_KEY_CHECKS = 1;
