import mysql from 'mysql2/promise'

if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD) {
  throw new Error(
    '未設定 MYSQL_USER / MYSQL_PASSWORD。請複製 .env.example 為 .env 並填入正確值，或於啟動時 export 環境變數。'
  )
}

const config = {
  host:     process.env.MYSQL_HOST || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3306', 10),
  user:     process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || 'tuition_calculator',
  connectionLimit: 10,
  waitForConnections: true,
  dateStrings: true,
}

export const pool = mysql.createPool(config)

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id            VARCHAR(64)  NOT NULL PRIMARY KEY,
      name          VARCHAR(128) NOT NULL,
      contact_name  VARCHAR(128) NOT NULL DEFAULT '',
      contact_phone VARCHAR(64)  NOT NULL DEFAULT '',
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_students_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: 既有 students 表補上聯絡人 / 電話 / 學校 / 年級欄位
  const [stuExtraCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
       AND COLUMN_NAME IN ('contact_name', 'contact_phone', 'school', 'grade')`
  )
  const stuExtraSet = new Set(stuExtraCols.map(c => c.COLUMN_NAME))
  if (!stuExtraSet.has('contact_name')) {
    await pool.query(`ALTER TABLE students ADD COLUMN contact_name VARCHAR(128) NOT NULL DEFAULT '' AFTER name`)
  }
  if (!stuExtraSet.has('contact_phone')) {
    await pool.query(`ALTER TABLE students ADD COLUMN contact_phone VARCHAR(64) NOT NULL DEFAULT '' AFTER contact_name`)
  }
  if (!stuExtraSet.has('school')) {
    await pool.query(`ALTER TABLE students ADD COLUMN school VARCHAR(128) NOT NULL DEFAULT '' AFTER name`)
  }
  if (!stuExtraSet.has('grade')) {
    await pool.query(`ALTER TABLE students ADD COLUMN grade VARCHAR(32) NOT NULL DEFAULT '' AFTER school`)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      name        VARCHAR(128) NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_teachers_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id          VARCHAR(64)    NOT NULL PRIMARY KEY,
      name        VARCHAR(128)   NOT NULL,
      hourly_rate DECIMAL(10,2)  NOT NULL DEFAULT 0,
      created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_courses_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: add hourly_rate to existing courses table if missing
  // (MySQL does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'hourly_rate'`
  )
  if (cols.length === 0) {
    await pool.query(
      `ALTER TABLE courses ADD COLUMN hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0`
    )
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lesson_records (
      id           VARCHAR(64)    NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)    NOT NULL,
      course_id    VARCHAR(64)    NOT NULL,
      teacher_id   VARCHAR(64)    NULL DEFAULT NULL,
      hours        DECIMAL(5,2)   NOT NULL,
      lesson_date  DATE           NOT NULL,
      unit_price   DECIMAL(10,2)  NULL DEFAULT NULL,
      note         VARCHAR(256)   NOT NULL DEFAULT '',
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
      INDEX idx_lesson_date    (lesson_date),
      INDEX idx_lesson_student (student_id, lesson_date),
      INDEX idx_lesson_teacher (teacher_id, lesson_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: add unit_price to existing lesson_records table if missing
  const [lrCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'unit_price'`
  )
  if (lrCols.length === 0) {
    await pool.query(
      `ALTER TABLE lesson_records ADD COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL`
    )
  }

  // Migration: add teacher_hourly_rate to existing courses table if missing
  const [courseTeacherRateCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'teacher_hourly_rate'`
  )
  if (courseTeacherRateCols.length === 0) {
    await pool.query(
      `ALTER TABLE courses ADD COLUMN teacher_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0`
    )
  }

  // Migration: add teacher_unit_price (per-lesson teacher hourly rate override) to lesson_records
  const [lrTeacherPriceCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'teacher_unit_price'`
  )
  if (lrTeacherPriceCols.length === 0) {
    await pool.query(
      `ALTER TABLE lesson_records ADD COLUMN teacher_unit_price DECIMAL(10,2) NULL DEFAULT NULL`
    )
  }

  // Migration: add start_time (TIME) to lesson_records — 用於課表顯示
  const [lrStartTimeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'start_time'`
  )
  if (lrStartTimeCols.length === 0) {
    await pool.query(`ALTER TABLE lesson_records ADD COLUMN start_time TIME NULL DEFAULT NULL`)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS materials (
      id          VARCHAR(64)    NOT NULL PRIMARY KEY,
      name        VARCHAR(128)   NOT NULL,
      unit_price  DECIMAL(10,2)  NOT NULL DEFAULT 0,
      created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_materials_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS material_records (
      id           VARCHAR(64)    NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)    NOT NULL,
      material_id  VARCHAR(64)    NOT NULL,
      quantity     DECIMAL(8,2)   NOT NULL DEFAULT 1,
      unit_price   DECIMAL(10,2)  NULL DEFAULT NULL,
      record_date  DATE           NOT NULL,
      note         VARCHAR(256)   NOT NULL DEFAULT '',
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id)  REFERENCES students(id)  ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      INDEX idx_mr_date    (record_date),
      INDEX idx_mr_student (student_id, record_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`groups\` (
      id               VARCHAR(64)    NOT NULL PRIMARY KEY,
      name             VARCHAR(128)   NOT NULL,
      weekdays         VARCHAR(15)    NOT NULL DEFAULT '',
      duration_months  TINYINT        NOT NULL DEFAULT 0,
      monthly_fee      DECIMAL(10,2)  NOT NULL DEFAULT 0,
      note             VARCHAR(256)   NOT NULL DEFAULT '',
      created_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_groups_name (name)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_records (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      group_id     VARCHAR(64)   NOT NULL,
      student_id   VARCHAR(64)   NOT NULL,
      record_date  DATE          NOT NULL,
      note         VARCHAR(256)  NOT NULL DEFAULT '',
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id)   REFERENCES \`groups\`(id)  ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id)   ON DELETE CASCADE,
      INDEX idx_gr_date    (record_date),
      INDEX idx_gr_group   (group_id, record_date),
      INDEX idx_gr_student (student_id, record_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS group_members (
      group_id    VARCHAR(64) NOT NULL,
      student_id  VARCHAR(64) NOT NULL,
      created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, student_id),
      FOREIGN KEY (group_id)   REFERENCES \`groups\`(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id)   ON DELETE CASCADE,
      INDEX idx_gm_student (student_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: add student_id to existing group_records table if missing
  const [grCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_records' AND COLUMN_NAME = 'student_id'`
  )
  if (grCols.length === 0) {
    // Existing rows would lack a student → drop them; this table only landed in the previous schema bump.
    await pool.query(`DELETE FROM group_records`)
    await pool.query(`ALTER TABLE group_records ADD COLUMN student_id VARCHAR(64) NOT NULL AFTER group_id`)
    await pool.query(`ALTER TABLE group_records ADD CONSTRAINT fk_gr_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE`)
    await pool.query(`ALTER TABLE group_records ADD INDEX idx_gr_student (student_id, record_date)`)
  }

  // Migration: add start_time + duration_hours to groups — 課表顯示用
  const [gTimeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME IN ('start_time', 'duration_hours')`
  )
  const gTimeSet = new Set(gTimeCols.map(c => c.COLUMN_NAME))
  if (!gTimeSet.has('start_time')) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN start_time TIME NULL DEFAULT NULL`)
  }
  if (!gTimeSet.has('duration_hours')) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN duration_hours DECIMAL(4,2) NOT NULL DEFAULT 0`)
  }

  // Migration: add duration_months to existing groups table if missing
  const [gDurCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'duration_months'`
  )
  if (gDurCols.length === 0) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN duration_months TINYINT NOT NULL DEFAULT 0 AFTER weekdays`)
  }

  // Migration: add monthly_fee to existing groups table if missing
  const [gFeeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'monthly_fee'`
  )
  if (gFeeCols.length === 0) {
    await pool.query(`ALTER TABLE \`groups\` ADD COLUMN monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER duration_months`)
  }

  // Migration: 加 courses.discount_multiplier（舊：每多一人乘 %）
  const [cDiscCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'discount_multiplier'`
  )
  if (cDiscCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN discount_multiplier DECIMAL(6,4) NOT NULL DEFAULT 1.0000 AFTER hourly_rate`)
  }

  // Migration: 加 courses.discount_per_student（新：每多一人 -X 元，預設 0 不打折；只用於家教課）
  const [cDiscPerCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'discount_per_student'`
  )
  if (cDiscPerCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN discount_per_student DECIMAL(10,2) NOT NULL DEFAULT 0`)
  }
  // Migration: 加 courses.default_teacher_id（預設老師，新增上課紀錄時自動帶入）
  const [cDefTeacherCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'default_teacher_id'`
  )
  if (cDefTeacherCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN default_teacher_id VARCHAR(64) NULL DEFAULT NULL`)
    await pool.query(`ALTER TABLE courses ADD CONSTRAINT fk_courses_default_teacher FOREIGN KEY (default_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL`)
  }

  // Migration: 拿掉舊的 discount_multiplier 欄位（已改成 discount_per_student）
  const [cMultLeft] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'discount_multiplier'`
  )
  if (cMultLeft.length > 0) {
    await pool.query(`ALTER TABLE courses DROP COLUMN discount_multiplier`)
  }

  // Migration: 加 courses.duration_hours，每堂課預設時數
  const [cDurationCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'duration_hours'`
  )
  if (cDurationCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN duration_hours DECIMAL(4,2) NOT NULL DEFAULT 1`)
  }

  // Migration: 加 courses.note，家教課備註
  const [cNoteCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'note'`
  )
  if (cNoteCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN note VARCHAR(256) NOT NULL DEFAULT ''`)
  }

  // Migration: 加 courses.sort_order，可手動拖曳排序
  const [cSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'sort_order'`
  )
  if (cSortCols.length === 0) {
    await pool.query(`ALTER TABLE courses ADD COLUMN sort_order INT NOT NULL DEFAULT 0`)
    // 把既有資料按 name ASC 給編號（每筆相差 10，方便日後手動插入）
    await pool.query(`SET @rn := 0`)
    await pool.query(`UPDATE courses SET sort_order = (@rn := @rn + 10) ORDER BY name ASC, id ASC`)
  }

  // Migration: 加 groups.sort_order
  const [gSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'sort_order'`
  )
  if (gSortCols.length === 0) {
    await pool.query('ALTER TABLE `groups` ADD COLUMN sort_order INT NOT NULL DEFAULT 0')
    await pool.query(`SET @rn := 0`)
    await pool.query('UPDATE `groups` SET sort_order = (@rn := @rn + 10) ORDER BY monthly_fee DESC, id ASC')
  }

  // Migration: 加 teachers.contact_phone
  const [tPhoneCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'contact_phone'`
  )
  if (tPhoneCols.length === 0) {
    await pool.query(`ALTER TABLE teachers ADD COLUMN contact_phone VARCHAR(64) NOT NULL DEFAULT '' AFTER name`)
  }

  // Migration: 加 teachers.sort_order
  const [tSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'sort_order'`
  )
  if (tSortCols.length === 0) {
    await pool.query(`ALTER TABLE teachers ADD COLUMN sort_order INT NOT NULL DEFAULT 0`)
    await pool.query(`SET @rn := 0`)
    await pool.query(`UPDATE teachers SET sort_order = (@rn := @rn + 10) ORDER BY created_at DESC, id DESC`)
  }

  // Migration: 加 group_records.status / lesson_records.status
  // pending = 待點名 / attended = 已點名 / pre_enroll = 報名前自動補的（紫）
  for (const tbl of ['group_records', 'lesson_records']) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'status'`,
      [tbl]
    )
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'attended'`)
    }
  }
  // 既有以 note='尚未開始開課' 標記的，回填到新欄位
  await pool.query(`UPDATE group_records SET status = 'pre_enroll' WHERE note = '尚未開始開課'`)

  // Migration: 加 group_records.teacher_id（記錄該次點名的老師）
  const [grtCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'group_records' AND COLUMN_NAME = 'teacher_id'`
  )
  if (grtCols.length === 0) {
    await pool.query(`ALTER TABLE group_records ADD COLUMN teacher_id VARCHAR(64) NULL DEFAULT NULL AFTER student_id`)
    await pool.query(`ALTER TABLE group_records ADD CONSTRAINT fk_gr_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL`)
    await pool.query(`ALTER TABLE group_records ADD INDEX idx_gr_teacher (teacher_id, record_date)`)
  }

  // Migration: 加 groups.teacher_hourly_rate（團課老師時薪，用於薪資結算）
  const [gThrCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'teacher_hourly_rate'`
  )
  if (gThrCols.length === 0) {
    await pool.query('ALTER TABLE `groups` ADD COLUMN teacher_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0')
  }

  // Migration: 加 groups.salary_type / monthly_salary（月薪型團課）
  const [gStCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'salary_type'`
  )
  if (gStCols.length === 0) {
    await pool.query("ALTER TABLE `groups` ADD COLUMN salary_type ENUM('hourly','monthly') NOT NULL DEFAULT 'hourly'")
  }
  const [gMsCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'monthly_salary'`
  )
  if (gMsCols.length === 0) {
    await pool.query('ALTER TABLE `groups` ADD COLUMN monthly_salary DECIMAL(10,2) NOT NULL DEFAULT 0')
  }

  // Migration: 加 groups.default_teacher_id（點名時自動帶入的老師）
  const [gDefTcols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'groups' AND COLUMN_NAME = 'default_teacher_id'`
  )
  if (gDefTcols.length === 0) {
    await pool.query('ALTER TABLE `groups` ADD COLUMN default_teacher_id VARCHAR(64) NULL DEFAULT NULL')
    await pool.query('ALTER TABLE `groups` ADD CONSTRAINT fk_groups_default_teacher FOREIGN KEY (default_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL')
  }

  // 雜項支出
  await pool.query(`
    CREATE TABLE IF NOT EXISTS misc_expenses (
      id           VARCHAR(64)    NOT NULL PRIMARY KEY,
      name         VARCHAR(128)   NOT NULL,
      category     VARCHAR(32)    NOT NULL DEFAULT '其他',
      amount       DECIMAL(10,2)  NOT NULL DEFAULT 0,
      expense_date DATE           NOT NULL,
      note         VARCHAR(256)   NOT NULL DEFAULT '',
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_misc_date (expense_date),
      INDEX idx_misc_category (category)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // Migration: material_records 補 unit_price 欄位（snapshot 當下教材單價，避免日後改價回溯改帳）
  const [mrUnitCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'material_records' AND COLUMN_NAME = 'unit_price'`
  )
  if (mrUnitCols.length === 0) {
    await pool.query(`ALTER TABLE material_records ADD COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL AFTER quantity`)
    // 既有紀錄用目前 materials.unit_price 回填，之後改價就不會動到舊紀錄
    await pool.query(`
      UPDATE material_records mr
      JOIN materials m ON m.id = mr.material_id
      SET mr.unit_price = m.unit_price
      WHERE mr.unit_price IS NULL
    `)
  }

  // Migration: misc_expenses 補 category 欄位（房租／水電／行銷／其他）
  const [meCatCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'misc_expenses' AND COLUMN_NAME = 'category'`
  )
  if (meCatCols.length === 0) {
    await pool.query(`ALTER TABLE misc_expenses ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT '其他' AFTER name`)
    await pool.query(`ALTER TABLE misc_expenses ADD INDEX idx_misc_category (category)`)
  }

  // Migration: 把 lesson_records.teacher_id 改成 nullable（允許未指派老師的上課紀錄）
  const [lrTeacherCol] = await pool.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'teacher_id'`
  )
  if (lrTeacherCol.length && lrTeacherCol[0].IS_NULLABLE === 'NO') {
    const [fkRows] = await pool.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records'
         AND COLUMN_NAME = 'teacher_id' AND REFERENCED_TABLE_NAME = 'teachers'`
    )
    for (const r of fkRows) {
      await pool.query(`ALTER TABLE lesson_records DROP FOREIGN KEY \`${r.CONSTRAINT_NAME}\``)
    }
    await pool.query(`ALTER TABLE lesson_records MODIFY teacher_id VARCHAR(64) NULL DEFAULT NULL`)
    await pool.query(`ALTER TABLE lesson_records ADD CONSTRAINT fk_lesson_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL`)
  }

  // Migration: 加 lesson_records.from_enroll_batch（標記是否為「學生選課」批次建立的紀錄；
  // 取消選課時，僅這類紀錄會被自動刪除，手動建立的紀錄保留）
  const [lrBatchCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lesson_records' AND COLUMN_NAME = 'from_enroll_batch'`
  )
  if (lrBatchCols.length === 0) {
    await pool.query(`ALTER TABLE lesson_records ADD COLUMN from_enroll_batch TINYINT(1) NOT NULL DEFAULT 0`)
  }

  // Migration: 加 students.sort_order
  const [sSortCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'sort_order'`
  )
  if (sSortCols.length === 0) {
    await pool.query(`ALTER TABLE students ADD COLUMN sort_order INT NOT NULL DEFAULT 0`)
    await pool.query(`SET @rn := 0`)
    await pool.query(`UPDATE students SET sort_order = (@rn := @rn + 10) ORDER BY created_at DESC, id DESC`)
  }
  // Migration: 早期版本曾經把 discount_multiplier 加在 groups 上，現在不用了，留欄位不影響但忽略


  // Migration: 把寫在 note 裡的純數字月費搬到 monthly_fee（適用早期資料）
  await pool.query(
    `UPDATE \`groups\`
        SET monthly_fee = CAST(note AS DECIMAL(10,2)),
            note = ''
      WHERE monthly_fee = 0
        AND note REGEXP '^[0-9]+(\\.[0-9]+)?$'
        AND CAST(note AS DECIMAL(10,2)) > 0`
  )
  // Migration: monthly_fee 已正確但 note 仍寫同樣數字的，清掉 note 避免重複顯示
  await pool.query(
    `UPDATE \`groups\`
        SET note = ''
      WHERE note REGEXP '^[0-9]+(\\.[0-9]+)?$'
        AND monthly_fee > 0
        AND CAST(note AS DECIMAL(10,2)) = monthly_fee`
  )

  // ── Student ↔ Course 報名表（家教課） ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_courses (
      student_id  VARCHAR(64) NOT NULL,
      course_id   VARCHAR(64) NOT NULL,
      created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      INDEX idx_sc_course (course_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  // 第一次建表時，從既有的 lesson_records 推回每位學生上過哪些課，避免舊資料失效
  const [scExist] = await pool.query('SELECT 1 FROM student_courses LIMIT 1')
  if (scExist.length === 0) {
    await pool.query(`
      INSERT IGNORE INTO student_courses (student_id, course_id)
      SELECT DISTINCT student_id, course_id FROM lesson_records
    `)
  }
  // 同樣補既有團課出席資料：若 group_members 為空但已有 group_records，從中推報名名單
  const [gmExist] = await pool.query('SELECT 1 FROM group_members LIMIT 1')
  if (gmExist.length === 0) {
    await pool.query(`
      INSERT IGNORE INTO group_members (group_id, student_id)
      SELECT DISTINCT group_id, student_id FROM group_records
    `)
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS period_locks (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      period_from DATE         NOT NULL,
      period_to   DATE         NOT NULL,
      note        VARCHAR(256) NOT NULL DEFAULT '',
      locked_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lock_period (period_from, period_to)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS share_tokens (
      id          VARCHAR(64)  NOT NULL PRIMARY KEY,
      token       VARCHAR(64)  NOT NULL UNIQUE,
      student_id  VARCHAR(64)  NOT NULL,
      period_from DATE         NOT NULL,
      period_to   DATE         NOT NULL,
      expires_at  DATETIME     NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      INDEX idx_share_tokens_token (token)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_records (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)   NOT NULL,
      period_from  DATE          NOT NULL,
      period_to    DATE          NOT NULL,
      paid_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      note         VARCHAR(256)  NOT NULL DEFAULT '',
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE KEY uk_payment (student_id, period_from, period_to),
      INDEX idx_payment_period (period_from, period_to)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id           VARCHAR(64)   NOT NULL PRIMARY KEY,
      student_id   VARCHAR(64)   NOT NULL,
      course_id    VARCHAR(64)   NOT NULL,
      leave_date   DATE          NOT NULL,
      reason       VARCHAR(512)  NOT NULL,
      created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id)  REFERENCES courses(id)  ON DELETE CASCADE,
      INDEX idx_leave_student (student_id, leave_date),
      INDEX idx_leave_date    (leave_date)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  // Migration: leave_requests 加 lesson_record_id（讓請假能精準綁到某一堂課，而非整天課程）
  const [lvRecCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'lesson_record_id'`
  )
  if (lvRecCols.length === 0) {
    await pool.query(`ALTER TABLE leave_requests ADD COLUMN lesson_record_id VARCHAR(64) NULL`)
    await pool.query(`ALTER TABLE leave_requests ADD CONSTRAINT fk_leave_lesson FOREIGN KEY (lesson_record_id) REFERENCES lesson_records(id) ON DELETE CASCADE`)
    await pool.query(`ALTER TABLE leave_requests ADD INDEX idx_leave_lesson (lesson_record_id)`)
  }

  // Migration: students/teachers 加 active 欄位（軟停用，取代真實刪除）
  for (const tbl of ['students', 'teachers']) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'active'`,
      [tbl]
    )
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1`)
      await pool.query(`ALTER TABLE \`${tbl}\` ADD INDEX idx_${tbl}_active (active)`)
    }
  }

  // ─── FEAT-012 Step 1: 多租戶 schema 預備 ────────────────────────────────
  // 新增 tenants 主表，並讓所有領域表帶 tenant_id（既有資料 backfill = 1）。
  // 此 step 只動 schema 不動 query —— query filter 在後續 step 加上。
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(128) NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  await pool.query("INSERT IGNORE INTO tenants (id, name) VALUES (1, '預設補習班')")

  const tenantAwareTables = [
    'students', 'teachers', 'courses', 'lesson_records',
    'materials', 'material_records',
    'groups', 'group_members', 'group_records',
    'misc_expenses', 'student_courses',
    'period_locks', 'share_tokens', 'payment_records', 'leave_requests',
  ]
  for (const tbl of tenantAwareTables) {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'tenant_id'`,
      [tbl]
    )
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tbl}\` ADD COLUMN tenant_id INT UNSIGNED NOT NULL DEFAULT 1`)
      await pool.query(`UPDATE \`${tbl}\` SET tenant_id = 1`)
      await pool.query(`ALTER TABLE \`${tbl}\` ADD INDEX idx_${tbl}_tenant (tenant_id)`)
      await pool.query(
        `ALTER TABLE \`${tbl}\` ADD CONSTRAINT fk_${tbl}_tenant ` +
        `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT`
      )
    }
  }

  // ── Care Module Schema（P1）────────────────────────────────────────────────

  // Migration: tenants 補 type 欄位
  const [tenantTypeCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'type'`
  )
  if (tenantTypeCols.length === 0) {
    await pool.query(
      `ALTER TABLE tenants ADD COLUMN \`type\` ENUM('tuition','care','both') NOT NULL DEFAULT 'both' AFTER name`
    )
  }

  // Migration: students 補 care_class、care_enrolled 欄位
  const [stuCareCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students'
       AND COLUMN_NAME IN ('care_class', 'care_enrolled')`
  )
  const stuCareSet = new Set(stuCareCols.map(c => c.COLUMN_NAME))
  if (!stuCareSet.has('care_class')) {
    await pool.query(`ALTER TABLE students ADD COLUMN care_class VARCHAR(64) NOT NULL DEFAULT '' AFTER grade`)
  }
  if (!stuCareSet.has('care_enrolled')) {
    await pool.query(`ALTER TABLE students ADD COLUMN care_enrolled TINYINT(1) NOT NULL DEFAULT 0 AFTER care_class`)
  }

  // care_share_tokens
  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_share_tokens (
      id          VARCHAR(64)  NOT NULL,
      tenant_id   INT UNSIGNED NOT NULL DEFAULT 1,
      student_id  VARCHAR(64)  NOT NULL,
      token       VARCHAR(64)  NOT NULL,
      expires_at  DATETIME     NOT NULL,
      created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_care_token (token),
      INDEX idx_cst_student (tenant_id, student_id),
      INDEX idx_cst_expires (expires_at)
    ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // care_attendance
  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_attendance (
      id           VARCHAR(64)  NOT NULL,
      tenant_id    INT UNSIGNED NOT NULL DEFAULT 1,
      student_id   VARCHAR(64)  NOT NULL,
      attend_date  DATE         NOT NULL,
      checkin_at   DATETIME     DEFAULT NULL,
      checkout_at  DATETIME     DEFAULT NULL,
      status       ENUM('present','absent','leave_approved') NOT NULL DEFAULT 'present',
      note         VARCHAR(255) NOT NULL DEFAULT '',
      created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_care_attend (tenant_id, student_id, attend_date),
      INDEX idx_care_attendance_date (tenant_id, attend_date)
    ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // care_logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_logs (
      id                   VARCHAR(64)  NOT NULL,
      tenant_id            INT UNSIGNED NOT NULL DEFAULT 1,
      student_id           VARCHAR(64)  NOT NULL,
      log_date             DATE         NOT NULL,
      teacher_note         TEXT         DEFAULT NULL,
      parent_note          TEXT         DEFAULT NULL,
      teacher_confirmed_at DATETIME     DEFAULT NULL,
      parent_confirmed_at  DATETIME     DEFAULT NULL,
      created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_care_log (tenant_id, student_id, log_date),
      INDEX idx_care_logs_date (tenant_id, log_date)
    ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)

  // care_leave_requests
  await pool.query(`
    CREATE TABLE IF NOT EXISTS care_leave_requests (
      id            VARCHAR(64)  NOT NULL,
      tenant_id     INT UNSIGNED NOT NULL DEFAULT 1,
      student_id    VARCHAR(64)  NOT NULL,
      leave_date    DATE         NOT NULL,
      reason        VARCHAR(255) NOT NULL DEFAULT '',
      status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reject_reason VARCHAR(255) NOT NULL DEFAULT '',
      created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_care_leave (tenant_id, student_id, leave_date),
      INDEX idx_care_leave_date (tenant_id, leave_date),
      INDEX idx_care_leave_status (tenant_id, status)
    ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
}

// ── Leave Requests ───────────────────────────────────────────────────────────

export async function insertLeaveRequest(tenantId, { id, studentId, courseId, leaveDate, reason, lessonRecordId }) {
  await pool.query(
    'INSERT INTO leave_requests (id, tenant_id, student_id, course_id, leave_date, reason, lesson_record_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, tenantId, studentId, courseId, leaveDate, reason, lessonRecordId || null]
  )
}

export async function listStudentLeaveRequests(tenantId, studentId, { from, to } = {}) {
  const where = ['lr.tenant_id = ?', 'lr.student_id = ?']
  const params = [tenantId, studentId]
  if (from) { where.push('lr.leave_date >= ?'); params.push(from) }
  if (to)   { where.push('lr.leave_date <= ?'); params.push(to) }
  const [rows] = await pool.query(
    `SELECT lr.id, lr.student_id, lr.course_id, lr.leave_date, lr.reason, lr.created_at, lr.lesson_record_id,
            c.name AS course_name
       FROM leave_requests lr
       JOIN courses c ON c.id = lr.course_id AND c.tenant_id = lr.tenant_id
      WHERE ${where.join(' AND ')}
      ORDER BY lr.leave_date DESC, lr.created_at DESC`,
    params
  )
  return rows
}

export async function deleteLeaveRequest(tenantId, id) {
  const [r] = await pool.query('DELETE FROM leave_requests WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return r.affectedRows > 0
}

// ── Students ─────────────────────────────────────────────────────────────────

export async function listStudents(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, school, grade, contact_name, contact_phone, sort_order, active FROM students WHERE tenant_id = ? ORDER BY active DESC, sort_order ASC, created_at DESC, id DESC',
    [tenantId]
  )
  return rows
}

export async function insertStudent(tenantId, { id, name, school, grade, contactName, contactPhone }) {
  await pool.query(
    'INSERT INTO students (id, tenant_id, name, school, grade, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, tenantId, name, school || '', grade || '', contactName || '', contactPhone || '']
  )
}

export async function updateStudent(tenantId, id, { name, school, grade, contactName, contactPhone }) {
  const sets = []
  const params = []
  if (name         !== undefined) { sets.push('name = ?');          params.push(name) }
  if (school       !== undefined) { sets.push('school = ?');        params.push(school || '') }
  if (grade        !== undefined) { sets.push('grade = ?');         params.push(grade || '') }
  if (contactName  !== undefined) { sets.push('contact_name = ?');  params.push(contactName || '') }
  if (contactPhone !== undefined) { sets.push('contact_phone = ?'); params.push(contactPhone || '') }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE students SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function setStudentActive(tenantId, id, active) {
  // 停用時清除「尚未點名」的家教課/團課紀錄（status NOT IN attended/leave，與 setStudentEnrollment 一致）
  if (!active) {
    await pool.query(
      `DELETE FROM lesson_records
       WHERE student_id = ? AND tenant_id = ? AND status NOT IN ('attended', 'leave', 'rescheduled', 'makeup')`,
      [id, tenantId]
    )
    await pool.query(
      `DELETE FROM group_records
       WHERE student_id = ? AND tenant_id = ? AND status NOT IN ('attended', 'leave', 'rescheduled', 'makeup')`,
      [id, tenantId]
    )
  }
  const [res] = await pool.query(
    'UPDATE students SET active = ? WHERE id = ? AND tenant_id = ?',
    [active ? 1 : 0, id, tenantId]
  )
  return res.affectedRows > 0
}

export async function getStudentEnrollment(tenantId, studentId) {
  const [courseRows] = await pool.query(
    'SELECT course_id FROM student_courses WHERE tenant_id = ? AND student_id = ?',
    [tenantId, studentId]
  )
  const [groupRows] = await pool.query(
    'SELECT gm.group_id FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.tenant_id = ? WHERE gm.student_id = ?',
    [tenantId, studentId]
  )
  return {
    course_ids: courseRows.map(r => r.course_id),
    group_ids:  groupRows.map(r => r.group_id),
  }
}

export async function setStudentEnrollment(tenantId, studentId, { courseIds, groupIds }) {
  if (Array.isArray(courseIds)) {
    const cleaned = Array.from(new Set(courseIds.filter(Boolean)))

    // 找出本次被移除的家教課；只清除「由選課批次建立 + 未點名／尚未開始」的紀錄
    // （已點名 'attended' / 請假 'leave' / 手動建立的紀錄都保留）
    const [existRows] = await pool.query(
      'SELECT course_id FROM student_courses WHERE tenant_id = ? AND student_id = ?',
      [tenantId, studentId]
    )
    const newSet = new Set(cleaned)
    const removed = existRows.map(r => r.course_id).filter(cid => !newSet.has(cid))
    if (removed.length) {
      await pool.query(
        `DELETE FROM lesson_records
         WHERE tenant_id = ? AND student_id = ? AND course_id IN (?)
           AND from_enroll_batch = 1
           AND status NOT IN ('attended', 'leave', 'rescheduled', 'makeup')`,
        [tenantId, studentId, removed]
      )
    }

    await pool.query('DELETE FROM student_courses WHERE tenant_id = ? AND student_id = ?', [tenantId, studentId])
    if (cleaned.length) {
      await pool.query(
        'INSERT INTO student_courses (tenant_id, student_id, course_id) VALUES ?',
        [cleaned.map(cid => [tenantId, studentId, cid])]
      )
    }
  }
  if (Array.isArray(groupIds)) {
    const cleaned = Array.from(new Set(groupIds.filter(Boolean)))
    // 抓既有 group_ids，找出本次「新增」的，用來自動補上課紀錄
    const [existRows] = await pool.query(
      'SELECT gm.group_id FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.tenant_id = ? WHERE gm.student_id = ?',
      [tenantId, studentId]
    )
    const existingSet = new Set(existRows.map(r => r.group_id))
    const newlyAdded = cleaned.filter(gid => !existingSet.has(gid))

    // 刪除時也需限 tenant（透過 JOIN groups）
    await pool.query(
      'DELETE gm FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.tenant_id = ? WHERE gm.student_id = ?',
      [tenantId, studentId]
    )
    if (cleaned.length) {
      await pool.query(
        'INSERT INTO group_members (group_id, student_id, tenant_id) VALUES ?',
        [cleaned.map(gid => [gid, studentId, tenantId])]
      )
    }

    for (const gid of newlyAdded) {
      try { await backfillGroupRecordsForStudent(tenantId, gid, studentId) }
      catch (e) { console.error('[backfillGroupRecords] failed:', gid, studentId, e) }
    }
  }
}

// ── Period Locks ─────────────────────────────────────────────────────────────

export async function listPeriodLocks(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, period_from, period_to, note, locked_at FROM period_locks WHERE tenant_id = ? ORDER BY period_from DESC',
    [tenantId]
  )
  return rows
}

export async function insertPeriodLock(tenantId, { id, periodFrom, periodTo, note }) {
  await pool.query(
    'INSERT INTO period_locks (id, tenant_id, period_from, period_to, note) VALUES (?, ?, ?, ?, ?)',
    [id, tenantId, periodFrom, periodTo, note || '']
  )
}

export async function deletePeriodLock(tenantId, id) {
  const [res] = await pool.query('DELETE FROM period_locks WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// 檢查某日期是否落在任一鎖定區間中（含端點）
export async function isDateLocked(tenantId, dateStr) {
  if (!dateStr) return false
  const [rows] = await pool.query(
    'SELECT 1 FROM period_locks WHERE tenant_id = ? AND ? BETWEEN period_from AND period_to LIMIT 1',
    [tenantId, dateStr]
  )
  return rows.length > 0
}

// 檢查紀錄 id 對應的日期是否被鎖
export async function isLessonLocked(tenantId, id) {
  const [rows] = await pool.query('SELECT lesson_date FROM lesson_records WHERE id = ? AND tenant_id = ?', [id, tenantId])
  if (rows.length === 0) return false
  return isDateLocked(tenantId, String(rows[0].lesson_date).slice(0, 10))
}

export async function isGroupRecordLocked(tenantId, id) {
  const [rows] = await pool.query('SELECT record_date FROM group_records WHERE id = ? AND tenant_id = ?', [id, tenantId])
  if (rows.length === 0) return false
  return isDateLocked(tenantId, String(rows[0].record_date).slice(0, 10))
}

// ── Misc Expenses ────────────────────────────────────────────────────────────

export async function listMiscExpenses(tenantId, { from, to, category } = {}) {
  const conds = ['tenant_id = ?']; const params = [tenantId]
  if (from)     { conds.push('expense_date >= ?'); params.push(from) }
  if (to)       { conds.push('expense_date <= ?'); params.push(to) }
  if (category) { conds.push('category = ?');      params.push(category) }
  const where = 'WHERE ' + conds.join(' AND ')
  const [rows] = await pool.query(
    `SELECT id, name, category, amount, expense_date, note FROM misc_expenses ${where} ORDER BY expense_date DESC, created_at DESC`,
    params
  )
  return rows.map(r => ({ ...r, amount: parseFloat(r.amount) }))
}

export async function insertMiscExpense(tenantId, { id, name, category, amount, expenseDate, note }) {
  await pool.query(
    'INSERT INTO misc_expenses (id, tenant_id, name, category, amount, expense_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, tenantId, name, category || '其他', amount, expenseDate, note || '']
  )
}

export async function sumMiscExpensesByCategory(tenantId, { from, to } = {}) {
  const conds = ['tenant_id = ?']; const params = [tenantId]
  if (from) { conds.push('expense_date >= ?'); params.push(from) }
  if (to)   { conds.push('expense_date <= ?'); params.push(to) }
  const where = 'WHERE ' + conds.join(' AND ')
  const [rows] = await pool.query(
    `SELECT category, SUM(amount) AS total FROM misc_expenses ${where} GROUP BY category ORDER BY category ASC`,
    params
  )
  return rows.map(r => ({ category: r.category, total: parseFloat(r.total || 0) }))
}

export async function updateMiscExpense(tenantId, id, { name, category, amount, expenseDate, note }) {
  const [res] = await pool.query(
    'UPDATE misc_expenses SET name = ?, category = ?, amount = ?, expense_date = ?, note = ? WHERE id = ? AND tenant_id = ?',
    [name, category || '其他', amount, expenseDate, note || '', id, tenantId]
  )
  return res.affectedRows > 0
}

export async function deleteMiscExpense(tenantId, id) {
  const [res] = await pool.query('DELETE FROM misc_expenses WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// 計算當日（伺服器當地時區）YYYY-MM-DD
function todayLocalIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 學生新加入某團課時，把整個 duration_months 區間內所有上課日補成 group_records
// 若該團課已開過課（已有紀錄），起始日從該團課最早一筆紀錄開始；否則從當日開始
// 早於當日的紀錄會標註 note='尚未開始開課'，方便結算與點名時辨別
const PRE_ENROLL_NOTE = '尚未開始開課'

async function backfillGroupRecordsForStudent(tenantId, groupId, studentId) {
  const [groupRows] = await pool.query(
    'SELECT weekdays, duration_months, default_teacher_id FROM `groups` WHERE id = ? AND tenant_id = ? LIMIT 1',
    [groupId, tenantId]
  )
  const g = groupRows[0]
  if (!g) return
  const months = parseInt(g.duration_months, 10)
  if (!months || months <= 0) return
  const weekdaySet = new Set(
    String(g.weekdays || '')
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
  )
  if (weekdaySet.size === 0) return

  const todayStr = todayLocalIso()
  // 起始日候選 1：該團課最早一筆既有紀錄
  const [earliestRows] = await pool.query(
    'SELECT MIN(record_date) AS first_date FROM group_records WHERE group_id = ?',
    [groupId]
  )
  const earliestExisting = earliestRows[0]?.first_date
    ? String(earliestRows[0].first_date).slice(0, 10)
    : null
  // 起始日候選 2：本週的週日（涵蓋本週已上過的課）
  const today = new Date(todayStr + 'T00:00:00')
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - today.getDay())
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  // 取兩者最小，再保證 ≤ 今天
  const candidates = [todayStr, weekStartStr]
  if (earliestExisting) candidates.push(earliestExisting)
  const startStr = candidates.sort()[0]

  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(start)
  end.setMonth(end.getMonth() + months)

  const dates = []
  const cur = new Date(start)
  while (cur < end) {
    if (weekdaySet.has(cur.getDay())) {
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, '0')
      const d = String(cur.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${d}`)
    }
    cur.setDate(cur.getDate() + 1)
  }
  if (dates.length === 0) return

  // 跳過該學生已有的紀錄日期
  const [existing] = await pool.query(
    'SELECT record_date FROM group_records WHERE group_id = ? AND student_id = ? AND record_date IN (?)',
    [groupId, studentId, dates]
  )
  const existingSet = new Set(existing.map(r => String(r.record_date).slice(0, 10)))
  const toInsert = dates.filter(d => !existingSet.has(d))
  if (toInsert.length === 0) return

  const teacherId = g.default_teacher_id || null
  const ts = Date.now()
  const rows = toInsert.map((d, i) => [
    `grr_${ts}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    tenantId, groupId, studentId, teacherId, d, '',
    d < todayStr ? 'pre_enroll' : 'pending',
  ])
  await pool.query(
    'INSERT INTO group_records (id, tenant_id, group_id, student_id, teacher_id, record_date, note, status) VALUES ?',
    [rows]
  )
}

export async function listAllEnrollments(tenantId) {
  const [courseRows] = await pool.query('SELECT student_id, course_id FROM student_courses WHERE tenant_id = ?', [tenantId])
  const [groupRows]  = await pool.query(
    'SELECT gm.student_id, gm.group_id FROM group_members gm JOIN `groups` g ON g.id = gm.group_id AND g.tenant_id = ?',
    [tenantId]
  )
  return { courses: courseRows, groups: groupRows }
}

export async function listStudentCourses(tenantId, studentId) {
  const [rows] = await pool.query(
    `SELECT lr.course_id, c.name AS course_name, lr.teacher_id, t.name AS teacher_name,
            MAX(lr.lesson_date) AS last_lesson_date
       FROM lesson_records lr
       JOIN courses  c ON c.id = lr.course_id AND c.tenant_id = lr.tenant_id
       LEFT JOIN teachers t ON t.id = lr.teacher_id AND t.tenant_id = lr.tenant_id
      WHERE lr.tenant_id = ? AND lr.student_id = ?
      GROUP BY lr.course_id, c.name, lr.teacher_id, t.name
      ORDER BY last_lesson_date DESC, c.name ASC`,
    [tenantId, studentId]
  )
  return rows
}

export async function listTeacherCourses(tenantId, teacherId) {
  // 家教課（distinct course）
  const [courseRows] = await pool.query(
    `SELECT lr.course_id, c.name AS course_name,
            COUNT(*) AS lesson_count,
            MAX(lr.lesson_date) AS last_lesson_date
       FROM lesson_records lr
       JOIN courses c ON c.id = lr.course_id AND c.tenant_id = lr.tenant_id
      WHERE lr.tenant_id = ? AND lr.teacher_id = ?
      GROUP BY lr.course_id, c.name
      ORDER BY last_lesson_date DESC, c.name ASC`,
    [tenantId, teacherId]
  )
  // 團課（distinct group）
  const [groupRows] = await pool.query(
    `SELECT gr.group_id, g.name AS group_name,
            COUNT(*) AS record_count,
            MAX(gr.record_date) AS last_record_date
       FROM group_records gr
       JOIN \`groups\` g ON g.id = gr.group_id AND g.tenant_id = gr.tenant_id
      WHERE gr.tenant_id = ? AND gr.teacher_id = ?
      GROUP BY gr.group_id, g.name
      ORDER BY last_record_date DESC, g.name ASC`,
    [tenantId, teacherId]
  )
  return { courses: courseRows, groups: groupRows }
}

// ── Teachers ──────────────────────────────────────────────────────────────────

export async function listTeachers(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, contact_phone, sort_order, active FROM teachers WHERE tenant_id = ? ORDER BY active DESC, sort_order ASC, created_at DESC, id DESC',
    [tenantId]
  )
  return rows
}

export async function reorderTeachers(tenantId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = `UPDATE teachers SET sort_order = CASE id ${cases} ELSE sort_order END WHERE id IN (?) AND tenant_id = ?`
  await pool.query(sql, [...orderedIds, orderedIds, tenantId])
}

export async function insertTeacher(tenantId, { id, name, contactPhone }) {
  await pool.query('INSERT INTO teachers (id, tenant_id, name, contact_phone) VALUES (?, ?, ?, ?)', [id, tenantId, name, contactPhone || ''])
}

export async function updateTeacher(tenantId, id, { name, contactPhone }) {
  const sets = []; const params = []
  if (name         !== undefined) { sets.push('name = ?');          params.push(name) }
  if (contactPhone !== undefined) { sets.push('contact_phone = ?'); params.push(contactPhone || '') }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE teachers SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function updateTeacherName(tenantId, id, name) {
  const [res] = await pool.query('UPDATE teachers SET name = ? WHERE id = ? AND tenant_id = ?', [name, id, tenantId])
  return res.affectedRows > 0
}

export async function setTeacherActive(tenantId, id, active) {
  const [res] = await pool.query(
    'UPDATE teachers SET active = ? WHERE id = ? AND tenant_id = ?',
    [active ? 1 : 0, id, tenantId]
  )
  return res.affectedRows > 0
}

// ── Courses ───────────────────────────────────────────────────────────────────

export async function listCourses(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, hourly_rate, teacher_hourly_rate, discount_per_student, default_teacher_id, duration_hours, note, sort_order FROM courses WHERE tenant_id = ? ORDER BY sort_order ASC, name ASC, id DESC',
    [tenantId]
  )
  return rows.map(r => ({
    ...r,
    discount_per_student: parseFloat(r.discount_per_student),
    duration_hours: parseFloat(r.duration_hours),
  }))
}

export async function reorderCourses(tenantId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  // 一次更新：用 CASE WHEN 把每個 id 對應到它的新 sort_order（每筆相差 10）
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = `UPDATE courses SET sort_order = CASE id ${cases} ELSE sort_order END WHERE id IN (?) AND tenant_id = ?`
  await pool.query(sql, [...orderedIds, orderedIds, tenantId])
}

export async function insertCourse(tenantId, { id, name, hourlyRate, teacherHourlyRate, discountPerStudent, defaultTeacherId, durationHours, note }) {
  await pool.query(
    'INSERT INTO courses (id, tenant_id, name, hourly_rate, teacher_hourly_rate, discount_per_student, default_teacher_id, duration_hours, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, tenantId, name, hourlyRate ?? 0, teacherHourlyRate ?? 0, discountPerStudent ?? 0, defaultTeacherId || null, durationHours ?? 1, note || '']
  )
}

export async function updateCourse(tenantId, id, { name, hourlyRate, teacherHourlyRate, discountPerStudent, defaultTeacherId, durationHours, note }) {
  const sets = []
  const params = []
  if (name               !== undefined) { sets.push('name = ?');                 params.push(name) }
  if (hourlyRate         !== undefined) { sets.push('hourly_rate = ?');          params.push(hourlyRate) }
  if (teacherHourlyRate  !== undefined) { sets.push('teacher_hourly_rate = ?');  params.push(teacherHourlyRate) }
  if (discountPerStudent !== undefined) { sets.push('discount_per_student = ?'); params.push(discountPerStudent) }
  if (defaultTeacherId   !== undefined) { sets.push('default_teacher_id = ?');   params.push(defaultTeacherId || null) }
  if (durationHours      !== undefined) { sets.push('duration_hours = ?');       params.push(durationHours) }
  if (note               !== undefined) { sets.push('note = ?');                 params.push(note || '') }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE courses SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteCourse(tenantId, id) {
  const [res] = await pool.query('DELETE FROM courses WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

function priceForLessonRecord(lr, sessionStudents) {
  if (lr.status === 'rescheduled') return 0
  if (lr.unit_price !== null && lr.unit_price !== undefined) return parseFloat(lr.unit_price)
  const key = `${lr.course_id}::${lr.lesson_date}::${lr.teacher_id}`
  const N = sessionStudents.get(key)?.size ?? 1
  const base = parseFloat(lr.course_hourly_rate ?? lr.hourly_rate ?? 0)
  const perStudent = parseFloat(lr.course_discount_per_student ?? 0)
  if (perStudent && perStudent > 0) return Math.max(0, Math.round(base - perStudent * Math.max(0, N - 1)))
  return base
}

async function loadGroupMemberCounts(groupIds) {
  const out = new Map()
  if (!groupIds.length) return out
  const [rows] = await pool.query(
    'SELECT group_id, COUNT(*) AS n FROM group_members WHERE group_id IN (?) GROUP BY group_id',
    [groupIds]
  )
  for (const r of rows) out.set(r.group_id, parseInt(r.n, 10))
  // 沒設報名名單的團課，fallback 用該期間實際出席人數推算（保守用 1）
  for (const id of groupIds) if (!out.has(id)) out.set(id, 1)
  return out
}

function buildSessionStudents(records) {
  const map = new Map()
  for (const lr of records) {
    const key = `${lr.course_id}::${lr.lesson_date}::${lr.teacher_id}`
    if (!map.has(key)) map.set(key, new Set())
    map.get(key).add(lr.student_id)
  }
  return map
}

// ── Lesson Records ────────────────────────────────────────────────────────────

export async function listLessons(tenantId, { from, to, studentId, teacherId, courseId } = {}) {
  const conditions = ['lr.tenant_id = ?']
  const params = [tenantId]

  if (from) { conditions.push('lr.lesson_date >= ?'); params.push(from) }
  if (to)   { conditions.push('lr.lesson_date <= ?'); params.push(to) }
  if (studentId) { conditions.push('lr.student_id = ?'); params.push(studentId) }
  if (teacherId) { conditions.push('lr.teacher_id = ?'); params.push(teacherId) }
  if (courseId)  { conditions.push('lr.course_id = ?');  params.push(courseId) }

  const where = 'WHERE ' + conditions.join(' AND ')

  const [rows] = await pool.query(
    `SELECT lr.id, lr.student_id, s.name AS student_name,
            lr.course_id, c.name AS course_name,
            lr.teacher_id, t.name AS teacher_name,
            lr.hours, lr.lesson_date, lr.start_time, lr.unit_price, lr.teacher_unit_price, lr.note, lr.status,
            c.hourly_rate         AS course_hourly_rate,
            c.teacher_hourly_rate AS course_teacher_hourly_rate,
            lv.id IS NOT NULL     AS is_on_leave,
            lv.id                 AS leave_request_id,
            lv.reason             AS leave_reason
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id AND s.tenant_id = lr.tenant_id
     JOIN courses  c ON c.id = lr.course_id  AND c.tenant_id = lr.tenant_id
     LEFT JOIN teachers t ON t.id = lr.teacher_id AND t.tenant_id = lr.tenant_id
     LEFT JOIN leave_requests lv
       ON lv.tenant_id = lr.tenant_id
       AND ((lv.lesson_record_id = lr.id)
       OR (lv.lesson_record_id IS NULL
           AND lv.student_id = lr.student_id
           AND lv.course_id  = lr.course_id
           AND lv.leave_date = lr.lesson_date))
     ${where}
     ORDER BY lr.lesson_date DESC, lr.start_time ASC, lr.created_at DESC`,
    params
  )
  return rows.map(r => ({ ...r, is_on_leave: !!r.is_on_leave }))
}

export async function findDuplicateLesson(tenantId, { studentId, courseId, lessonDate }) {
  const [rows] = await pool.query(
    `SELECT lr.id, lr.start_time, lr.hours, lr.teacher_id, t.name AS teacher_name
       FROM lesson_records lr
       LEFT JOIN teachers t ON t.id = lr.teacher_id AND t.tenant_id = lr.tenant_id
      WHERE lr.tenant_id = ? AND lr.student_id = ? AND lr.course_id = ? AND lr.lesson_date = ?
      ORDER BY lr.start_time IS NULL, lr.start_time ASC`,
    [tenantId, studentId, courseId, lessonDate]
  )
  return rows
}

export async function insertLesson(tenantId, { id, studentId, courseId, teacherId, hours, lessonDate, startTime, unitPrice, teacherUnitPrice, note, status, fromEnrollBatch }) {
  await pool.query(
    `INSERT INTO lesson_records (id, tenant_id, student_id, course_id, teacher_id, hours, lesson_date, start_time, unit_price, teacher_unit_price, note, status, from_enroll_batch)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, studentId, courseId, teacherId || null, hours, lessonDate, startTime || null, unitPrice ?? null, teacherUnitPrice ?? null, note || '', status || 'pending', fromEnrollBatch ? 1 : 0]
  )
}

export async function updateLesson(tenantId, id, { studentId, courseId, teacherId, hours, lessonDate, startTime, unitPrice, teacherUnitPrice, note, status }) {
  const sets = []
  const params = []
  if (studentId        !== undefined) { sets.push('student_id = ?');         params.push(studentId) }
  if (courseId         !== undefined) { sets.push('course_id = ?');          params.push(courseId) }
  if (teacherId        !== undefined) { sets.push('teacher_id = ?');         params.push(teacherId) }
  if (hours            !== undefined) { sets.push('hours = ?');              params.push(hours) }
  if (lessonDate       !== undefined) { sets.push('lesson_date = ?');        params.push(lessonDate) }
  if (startTime        !== undefined) { sets.push('start_time = ?');         params.push(startTime || null) }
  if (unitPrice        !== undefined) { sets.push('unit_price = ?');         params.push(unitPrice) }
  if (teacherUnitPrice !== undefined) { sets.push('teacher_unit_price = ?'); params.push(teacherUnitPrice) }
  if (note             !== undefined) { sets.push('note = ?');               params.push(note) }
  if (status           !== undefined) { sets.push('status = ?');             params.push(status) }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE lesson_records SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteLesson(tenantId, id) {
  const [res] = await pool.query('DELETE FROM lesson_records WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// ── Settlement ────────────────────────────────────────────────────────────────

export async function settlementTuition(tenantId, from, to) {
  // 逐筆取出，讓每筆紀錄的 unit_price 覆蓋優先於課程預設；其次查 course_rates 對照表（依當日同課同師實際出席人數），最後 fallback course.hourly_rate
  const [rows] = await pool.query(
    `SELECT
       lr.student_id,
       s.name                                        AS student_name,
       lr.course_id,
       c.name                                        AS course_name,
       lr.teacher_id,
       lr.lesson_date,
       lr.hours,
       lr.unit_price,
       lr.status,
       c.hourly_rate                                 AS course_hourly_rate,
       c.discount_per_student                        AS course_discount_per_student
     FROM lesson_records lr
     JOIN students s ON s.id = lr.student_id AND s.tenant_id = lr.tenant_id
     JOIN courses  c ON c.id = lr.course_id  AND c.tenant_id = lr.tenant_id
     WHERE lr.tenant_id = ? AND lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY s.name ASC, c.name ASC`,
    [tenantId, from, to]
  )

  const sessionStudents = buildSessionStudents(rows)

  // 先依 student + course + unit_price 合算，再彙整
  const map = new Map()
  for (const row of rows) {
    const unitPrice = priceForLessonRecord(row, sessionStudents)
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name, courses: new Map(), total: 0 })
    }
    const student  = map.get(row.student_id)
    const key      = `${row.course_id}::${unitPrice}`
    if (!student.courses.has(key)) {
      student.courses.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, unit_price: unitPrice, amount: 0 })
    }
    const entry = student.courses.get(key)
    const h = parseFloat(row.hours)
    entry.total_hours = Math.round((entry.total_hours + h) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.unit_price)
    student.total += Math.round(h * unitPrice)
  }

  // 合併團課費（按出席月份數 × 月費）
  const [grRows] = await pool.query(
    `SELECT
       gr.student_id,
       s.name                                        AS student_name,
       gr.group_id,
       g.name                                        AS group_name,
       g.monthly_fee,
       COUNT(DISTINCT DATE_FORMAT(gr.record_date, '%Y-%m')) AS billable_months
     FROM group_records gr
     JOIN \`groups\`  g ON g.id = gr.group_id AND g.tenant_id = gr.tenant_id
     JOIN students   s ON s.id = gr.student_id AND s.tenant_id = gr.tenant_id
     WHERE gr.tenant_id = ? AND gr.record_date >= ? AND gr.record_date <= ?
     GROUP BY gr.student_id, s.name, gr.group_id, g.name, g.monthly_fee
     ORDER BY s.name ASC, g.name ASC`,
    [tenantId, from, to]
  )
  for (const row of grRows) {
    if (!map.has(row.student_id)) {
      map.set(row.student_id, { student_id: row.student_id, student_name: row.student_name, courses: new Map(), total: 0 })
    }
    const student = map.get(row.student_id)
    if (!student.groups) student.groups = []
    const months     = parseInt(row.billable_months, 10)
    const monthlyFee = parseFloat(row.monthly_fee)
    const amount     = Math.round(months * monthlyFee)
    student.groups.push({ group_id: row.group_id, group_name: row.group_name, billable_months: months, monthly_fee: monthlyFee, amount })
    student.total += amount
  }

  // 合併教材費
  const [mrRows] = await pool.query(
    `SELECT
       mr.student_id,
       mr.material_id,
       m.name        AS material_name,
       m.unit_price,
       SUM(mr.quantity) AS total_qty
     FROM material_records mr
     JOIN materials m ON m.id = mr.material_id AND m.tenant_id = mr.tenant_id
     WHERE mr.tenant_id = ? AND mr.record_date >= ? AND mr.record_date <= ?
     GROUP BY mr.student_id, mr.material_id, m.name, m.unit_price`,
    [tenantId, from, to]
  )
  for (const row of mrRows) {
    if (!map.has(row.student_id)) continue // 只補既有學生（沒上課且沒上團課的教材費不列入）
    const student = map.get(row.student_id)
    if (!student.materials) student.materials = []
    const qty    = parseFloat(row.total_qty)
    const price  = parseFloat(row.unit_price)
    const amount = Math.round(qty * price)
    student.materials.push({ material_id: row.material_id, material_name: row.material_name, total_qty: qty, unit_price: price, amount })
    student.total += amount
  }

  return Array.from(map.values()).map(s => ({
    student_id: s.student_id,
    student_name: s.student_name,
    courses: Array.from(s.courses.values()),
    groups: s.groups || [],
    materials: s.materials || [],
    total: s.total,
  }))
}

export async function settlementSalary(tenantId, from, to) {
  const [rows] = await pool.query(
    `SELECT
       lr.teacher_id,
       t.name                                                          AS teacher_name,
       lr.course_id,
       c.name                                                          AS course_name,
       lr.hours,
       lr.status,
       COALESCE(lr.teacher_unit_price, c.teacher_hourly_rate)          AS hourly_rate
     FROM lesson_records lr
     JOIN teachers t ON t.id = lr.teacher_id AND t.tenant_id = lr.tenant_id
     JOIN courses  c ON c.id = lr.course_id  AND c.tenant_id = lr.tenant_id
     WHERE lr.tenant_id = ? AND lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY t.name ASC, c.name ASC`,
    [tenantId, from, to]
  )

  const map = new Map()
  for (const row of rows) {
    if (row.status === 'rescheduled') continue
    if (!map.has(row.teacher_id)) {
      map.set(row.teacher_id, { teacher_id: row.teacher_id, teacher_name: row.teacher_name, courses: new Map(), groups: new Map(), total: 0 })
    }
    const teacher = map.get(row.teacher_id)
    const key     = `${row.course_id}::${row.hourly_rate}`
    if (!teacher.courses.has(key)) {
      teacher.courses.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, hourly_rate: parseFloat(row.hourly_rate), amount: 0 })
    }
    const entry = teacher.courses.get(key)
    const h = parseFloat(row.hours)
    entry.total_hours = Math.round((entry.total_hours + h) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.hourly_rate)
    teacher.total += Math.round(h * entry.hourly_rate)
  }

  // 團課薪資：每一個 (group, record_date, teacher) 為一堂；排除 pre_enroll、無指派老師。
  // 時薪型 (salary_type='hourly')：金額 = duration_hours × teacher_hourly_rate，逐堂累加。
  // 月薪型 (salary_type='monthly')：以 (group_id, year-month) 為池，
  //   分母 Y = 該整月該團課所有老師上的總堂數；
  //   每位老師金額 = monthly_salary × (區間內該老師堂數 / Y)。
  //   預設老師當月零堂自然為 0；代課老師按比例分。
  const [groupRows] = await pool.query(
    `SELECT gr.teacher_id,
            t.name                          AS teacher_name,
            gr.group_id,
            g.name                          AS group_name,
            g.duration_hours                AS duration_hours,
            g.teacher_hourly_rate           AS hourly_rate,
            g.salary_type                   AS salary_type,
            g.monthly_salary                AS monthly_salary,
            gr.record_date,
            DATE_FORMAT(gr.record_date, '%Y-%m') AS ym
       FROM group_records gr
       JOIN \`groups\` g ON g.id = gr.group_id AND g.tenant_id = gr.tenant_id
       JOIN teachers   t ON t.id = gr.teacher_id AND t.tenant_id = gr.tenant_id
      WHERE gr.tenant_id = ? AND gr.record_date >= ? AND gr.record_date <= ?
        AND gr.teacher_id IS NOT NULL
        AND gr.status <> 'pre_enroll'
      GROUP BY gr.teacher_id, t.name, gr.group_id, g.name, g.duration_hours,
               g.teacher_hourly_rate, g.salary_type, g.monthly_salary, gr.record_date
      ORDER BY t.name ASC, g.name ASC, gr.record_date ASC`,
    [tenantId, from, to]
  )

  // 收集月薪型 (group_id, ym) 桶與 (teacher, group, ym) 區間內堂數 X
  const monthlyBuckets = new Map()  // key: `${group_id}::${ym}` -> { group_id, group_name, ym, monthly_salary, teachers: Map<teacher_id, { teacher_name, x }> }
  const monthlyGroupIds = new Set()
  const monthlyYms = new Set()

  for (const row of groupRows) {
    if (!map.has(row.teacher_id)) {
      map.set(row.teacher_id, { teacher_id: row.teacher_id, teacher_name: row.teacher_name, courses: new Map(), groups: new Map(), total: 0 })
    }

    if (row.salary_type === 'monthly') {
      const ym = String(row.ym)
      const key = `${row.group_id}::${ym}`
      if (!monthlyBuckets.has(key)) {
        monthlyBuckets.set(key, {
          group_id: row.group_id, group_name: row.group_name,
          ym, monthly_salary: parseFloat(row.monthly_salary || 0),
          teachers: new Map(),
        })
      }
      const bucket = monthlyBuckets.get(key)
      if (!bucket.teachers.has(row.teacher_id)) {
        bucket.teachers.set(row.teacher_id, { teacher_id: row.teacher_id, teacher_name: row.teacher_name, x: 0 })
      }
      bucket.teachers.get(row.teacher_id).x += 1
      monthlyGroupIds.add(row.group_id)
      monthlyYms.add(ym)
    } else {
      const teacher = map.get(row.teacher_id)
      const rate = parseFloat(row.hourly_rate || 0)
      const dh   = parseFloat(row.duration_hours || 0)
      const key  = `hourly::${row.group_id}::${rate}::${dh}`
      if (!teacher.groups.has(key)) {
        teacher.groups.set(key, {
          kind: 'hourly',
          group_id: row.group_id, group_name: row.group_name,
          duration_hours: dh, hourly_rate: rate,
          session_count: 0, total_hours: 0, amount: 0,
        })
      }
      const entry = teacher.groups.get(key)
      entry.session_count += 1
      entry.total_hours = Math.round((entry.session_count * dh) * 100) / 100
      entry.amount = Math.round(entry.total_hours * rate)
      teacher.total += Math.round(dh * rate)
    }
  }

  // 月薪型：查每個 (group_id, ym) 的整月分母 Y（不限區間）
  if (monthlyBuckets.size > 0) {
    const yms = Array.from(monthlyYms).sort()
    const firstYm = yms[0]
    const lastYm  = yms[yms.length - 1]
    const [ly, lm] = lastYm.split('-').map(s => parseInt(s, 10))
    const lastDay = new Date(ly, lm, 0).getDate()
    const monthRangeFrom = `${firstYm}-01`
    const monthRangeTo   = `${lastYm}-${String(lastDay).padStart(2, '0')}`

    const [yRows] = await pool.query(
      `SELECT gr.group_id,
              DATE_FORMAT(gr.record_date, '%Y-%m') AS ym,
              COUNT(DISTINCT CONCAT(gr.record_date, '|', gr.teacher_id)) AS total
         FROM group_records gr
         JOIN \`groups\` g ON g.id = gr.group_id AND g.tenant_id = gr.tenant_id
        WHERE gr.tenant_id = ? AND gr.group_id IN (?)
          AND gr.record_date >= ? AND gr.record_date <= ?
          AND gr.teacher_id IS NOT NULL
          AND gr.status <> 'pre_enroll'
          AND g.salary_type = 'monthly'
        GROUP BY gr.group_id, ym`,
      [tenantId, Array.from(monthlyGroupIds), monthRangeFrom, monthRangeTo]
    )
    const yMap = new Map()
    for (const r of yRows) yMap.set(`${r.group_id}::${r.ym}`, parseInt(r.total, 10))

    for (const bucket of monthlyBuckets.values()) {
      const Y = yMap.get(`${bucket.group_id}::${bucket.ym}`) || 0
      if (Y === 0) continue
      for (const tEntry of bucket.teachers.values()) {
        if (tEntry.x === 0) continue
        const teacher = map.get(tEntry.teacher_id)
        const fraction = tEntry.x / Y
        const amount = Math.round(bucket.monthly_salary * fraction)
        const key = `monthly::${bucket.group_id}::${bucket.monthly_salary}`
        if (!teacher.groups.has(key)) {
          teacher.groups.set(key, {
            kind: 'monthly',
            group_id: bucket.group_id, group_name: bucket.group_name,
            monthly_salary: bucket.monthly_salary,
            month_fraction: 0,
            x_sum: 0, y_sum: 0,
            amount: 0,
          })
        }
        const entry = teacher.groups.get(key)
        entry.month_fraction = Math.round((entry.month_fraction + fraction) * 10000) / 10000
        entry.x_sum += tEntry.x
        entry.y_sum += Y
        entry.amount += amount
        teacher.total += amount
      }
    }
  }

  return Array.from(map.values()).map(t => ({
    teacher_id: t.teacher_id,
    teacher_name: t.teacher_name,
    courses: Array.from(t.courses.values()),
    groups:  Array.from(t.groups.values()),
    total: t.total,
  }))
}

// ── Reschedule / Makeup stats ────────────────────────────────────────────────

// 計入「課次」的狀態（pending / pre_enroll 視為尚未發生，不算）
const COUNTABLE_STATUSES = ['attended', 'leave', 'rescheduled', 'makeup']

export async function statsReschedule(tenantId, from, to, studentId = null) {
  const params = [tenantId, from, to, ...COUNTABLE_STATUSES]
  let where = 'lr.tenant_id = ? AND lr.lesson_date >= ? AND lr.lesson_date <= ? AND lr.status IN (?, ?, ?, ?)'
  if (studentId) {
    where += ' AND lr.student_id = ?'
    params.push(studentId)
  }
  const [rows] = await pool.query(
    `SELECT lr.student_id, s.name AS student_name, lr.status, COUNT(*) AS n
       FROM lesson_records lr
       JOIN students s ON s.id = lr.student_id AND s.tenant_id = lr.tenant_id
      WHERE ${where}
      GROUP BY lr.student_id, s.name, lr.status`,
    params
  )

  const perStudent = new Map()
  for (const r of rows) {
    if (!perStudent.has(r.student_id)) {
      perStudent.set(r.student_id, {
        student_id: r.student_id,
        student_name: r.student_name,
        total_lessons: 0,
        reschedule_count: 0,
        makeup_count: 0,
        reschedule_rate: 0,
      })
    }
    const ent = perStudent.get(r.student_id)
    const n = parseInt(r.n, 10)
    ent.total_lessons += n
    if (r.status === 'rescheduled') ent.reschedule_count = n
    else if (r.status === 'makeup') ent.makeup_count = n
  }
  for (const ent of perStudent.values()) {
    ent.reschedule_rate = ent.total_lessons > 0
      ? Math.round((ent.reschedule_count / ent.total_lessons) * 1000) / 10
      : 0
  }

  let total = 0, resched = 0, makeup = 0
  for (const ent of perStudent.values()) {
    total += ent.total_lessons
    resched += ent.reschedule_count
    makeup += ent.makeup_count
  }

  const summary = {
    total_lessons: total,
    reschedule_count: resched,
    makeup_count: makeup,
    reschedule_rate: total > 0 ? Math.round((resched / total) * 1000) / 10 : 0,
  }

  if (studentId) {
    return perStudent.get(studentId) || {
      student_id: studentId,
      student_name: null,
      total_lessons: 0,
      reschedule_count: 0,
      makeup_count: 0,
      reschedule_rate: 0,
    }
  }

  return {
    ...summary,
    by_student: Array.from(perStudent.values()).sort((a, b) => b.reschedule_rate - a.reschedule_rate),
  }
}

// ── Materials ─────────────────────────────────────────────────────────────────

export async function listMaterials(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, unit_price FROM materials WHERE tenant_id = ? ORDER BY unit_price DESC, id DESC',
    [tenantId]
  )
  return rows
}

export async function insertMaterial(tenantId, { id, name, unitPrice }) {
  await pool.query('INSERT INTO materials (id, tenant_id, name, unit_price) VALUES (?, ?, ?, ?)', [id, tenantId, name, unitPrice ?? 0])
}

export async function updateMaterial(tenantId, id, { name, unitPrice }) {
  const sets = []; const params = []
  if (name      !== undefined) { sets.push('name = ?');       params.push(name) }
  if (unitPrice !== undefined) { sets.push('unit_price = ?'); params.push(unitPrice) }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE materials SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteMaterial(tenantId, id) {
  const [res] = await pool.query('DELETE FROM materials WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// ── Material Records ──────────────────────────────────────────────────────────

export async function listMaterialRecords(tenantId, { from, to, studentId } = {}) {
  const conditions = ['mr.tenant_id = ?']; const params = [tenantId]
  if (from)      { conditions.push('mr.record_date >= ?'); params.push(from) }
  if (to)        { conditions.push('mr.record_date <= ?'); params.push(to) }
  if (studentId) { conditions.push('mr.student_id = ?');   params.push(studentId) }
  const where = 'WHERE ' + conditions.join(' AND ')
  const [rows] = await pool.query(
    `SELECT mr.id, mr.student_id, s.name AS student_name,
            mr.material_id, m.name AS material_name,
            COALESCE(mr.unit_price, m.unit_price) AS unit_price,
            mr.quantity, mr.record_date, mr.note
     FROM material_records mr
     JOIN students  s ON s.id = mr.student_id  AND s.tenant_id = mr.tenant_id
     JOIN materials m ON m.id = mr.material_id AND m.tenant_id = mr.tenant_id
     ${where}
     ORDER BY mr.record_date DESC, mr.created_at DESC`,
    params
  )
  return rows
}

export async function insertMaterialRecord(tenantId, { id, studentId, materialId, quantity, recordDate, note, unitPrice }) {
  // 沒指定就 snapshot 當下 materials.unit_price
  let snapPrice = unitPrice
  if (snapPrice === undefined || snapPrice === null) {
    const [matRows] = await pool.query('SELECT unit_price FROM materials WHERE id = ? AND tenant_id = ? LIMIT 1', [materialId, tenantId])
    snapPrice = matRows[0]?.unit_price ?? 0
  }
  await pool.query(
    `INSERT INTO material_records (id, tenant_id, student_id, material_id, quantity, unit_price, record_date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, studentId, materialId, quantity ?? 1, snapPrice, recordDate, note || '']
  )
}

export async function sumMaterialCost(tenantId, { from, to } = {}) {
  const conds = ['mr.tenant_id = ?']; const params = [tenantId]
  if (from) { conds.push('mr.record_date >= ?'); params.push(from) }
  if (to)   { conds.push('mr.record_date <= ?'); params.push(to) }
  const where = 'WHERE ' + conds.join(' AND ')
  const [rows] = await pool.query(
    `SELECT COALESCE(SUM(mr.quantity * COALESCE(mr.unit_price, m.unit_price)), 0) AS total
       FROM material_records mr
       JOIN materials m ON m.id = mr.material_id AND m.tenant_id = mr.tenant_id
       ${where}`,
    params
  )
  return parseFloat(rows[0]?.total || 0)
}

export async function updateMaterialRecord(tenantId, id, { studentId, materialId, quantity, recordDate, note, unitPrice }) {
  const sets = []; const params = []
  if (studentId  !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (materialId !== undefined) { sets.push('material_id = ?'); params.push(materialId) }
  if (quantity   !== undefined) { sets.push('quantity = ?');    params.push(quantity) }
  if (recordDate !== undefined) { sets.push('record_date = ?'); params.push(recordDate) }
  if (note       !== undefined) { sets.push('note = ?');        params.push(note) }
  // 換教材時自動 re-snapshot 當下的單價（除非呼叫端明確傳 unitPrice）
  if (unitPrice !== undefined) {
    sets.push('unit_price = ?'); params.push(unitPrice)
  } else if (materialId !== undefined) {
    const [mr] = await pool.query('SELECT unit_price FROM materials WHERE id = ? AND tenant_id = ? LIMIT 1', [materialId, tenantId])
    sets.push('unit_price = ?'); params.push(mr[0]?.unit_price ?? 0)
  }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE material_records SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteMaterialRecord(tenantId, id) {
  const [res] = await pool.query('DELETE FROM material_records WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// ── Groups ───────────────────────────────────────────────────────────────────

export async function listGroups(tenantId) {
  const [rows] = await pool.query(
    'SELECT id, name, weekdays, duration_months, monthly_fee, start_time, duration_hours, teacher_hourly_rate, salary_type, monthly_salary, note, default_teacher_id, sort_order FROM `groups` WHERE tenant_id = ? ORDER BY sort_order ASC, monthly_fee DESC, id DESC',
    [tenantId]
  )
  return rows.map(r => ({
    ...r,
    duration_hours: parseFloat(r.duration_hours),
    teacher_hourly_rate: parseFloat(r.teacher_hourly_rate || 0),
    monthly_salary: parseFloat(r.monthly_salary || 0),
  }))
}

export async function reorderGroups(tenantId, orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return
  const cases = orderedIds.map((_, i) => `WHEN ? THEN ${(i + 1) * 10}`).join(' ')
  const sql = 'UPDATE `groups` SET sort_order = CASE id ' + cases + ' ELSE sort_order END WHERE id IN (?) AND tenant_id = ?'
  await pool.query(sql, [...orderedIds, orderedIds, tenantId])
}

export async function insertGroup(tenantId, { id, name, weekdays, durationMonths, monthlyFee, startTime, durationHours, teacherHourlyRate, salaryType, monthlySalary, note, defaultTeacherId }) {
  await pool.query(
    'INSERT INTO `groups` (id, tenant_id, name, weekdays, duration_months, monthly_fee, start_time, duration_hours, teacher_hourly_rate, salary_type, monthly_salary, note, default_teacher_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, tenantId, name, weekdays || '', durationMonths ?? 0, monthlyFee ?? 0, startTime || null, durationHours ?? 0, teacherHourlyRate ?? 0, salaryType || 'hourly', monthlySalary ?? 0, note || '', defaultTeacherId || null]
  )
}

export async function updateGroup(tenantId, id, { name, weekdays, durationMonths, monthlyFee, startTime, durationHours, teacherHourlyRate, salaryType, monthlySalary, note, defaultTeacherId }) {
  const sets = []; const params = []
  if (name              !== undefined) { sets.push('name = ?');                params.push(name) }
  if (weekdays          !== undefined) { sets.push('weekdays = ?');            params.push(weekdays || '') }
  if (durationMonths    !== undefined) { sets.push('duration_months = ?');     params.push(durationMonths) }
  if (monthlyFee        !== undefined) { sets.push('monthly_fee = ?');         params.push(monthlyFee) }
  if (startTime         !== undefined) { sets.push('start_time = ?');          params.push(startTime || null) }
  if (durationHours     !== undefined) { sets.push('duration_hours = ?');      params.push(durationHours) }
  if (teacherHourlyRate !== undefined) { sets.push('teacher_hourly_rate = ?'); params.push(teacherHourlyRate) }
  if (salaryType        !== undefined) { sets.push('salary_type = ?');         params.push(salaryType) }
  if (monthlySalary     !== undefined) { sets.push('monthly_salary = ?');      params.push(monthlySalary) }
  if (note              !== undefined) { sets.push('note = ?');                params.push(note || '') }
  if (defaultTeacherId  !== undefined) { sets.push('default_teacher_id = ?');  params.push(defaultTeacherId || null) }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE \`groups\` SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteGroup(tenantId, id) {
  const [res] = await pool.query('DELETE FROM `groups` WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// ── Group Records ────────────────────────────────────────────────────────────

export async function listGroupRecords(tenantId, { from, to, groupId, studentId, teacherId } = {}) {
  const conditions = ['gr.tenant_id = ?']; const params = [tenantId]
  if (from)      { conditions.push('gr.record_date >= ?'); params.push(from) }
  if (to)        { conditions.push('gr.record_date <= ?'); params.push(to) }
  if (groupId)   { conditions.push('gr.group_id = ?');     params.push(groupId) }
  if (studentId) { conditions.push('gr.student_id = ?');   params.push(studentId) }
  if (teacherId) { conditions.push('gr.teacher_id = ?');   params.push(teacherId) }
  const where = 'WHERE ' + conditions.join(' AND ')
  const [rows] = await pool.query(
    `SELECT gr.id, gr.group_id, g.name AS group_name,
            gr.student_id, s.name AS student_name,
            gr.teacher_id, t.name AS teacher_name,
            gr.record_date, gr.note, gr.status,
            g.start_time AS group_start_time,
            g.duration_hours AS group_duration_hours
     FROM group_records gr
     JOIN \`groups\`  g ON g.id = gr.group_id  AND g.tenant_id = gr.tenant_id
     JOIN students   s ON s.id = gr.student_id AND s.tenant_id = gr.tenant_id
     LEFT JOIN teachers t ON t.id = gr.teacher_id AND t.tenant_id = gr.tenant_id
     ${where}
     ORDER BY gr.record_date DESC, gr.created_at DESC`,
    params
  )
  return rows
}

export async function insertGroupRecord(tenantId, { id, groupId, studentId, teacherId, recordDate, note, status }) {
  await pool.query(
    `INSERT INTO group_records (id, tenant_id, group_id, student_id, teacher_id, record_date, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, groupId, studentId, teacherId || null, recordDate, note || '', status || 'pending']
  )
}

export async function updateGroupRecord(tenantId, id, { groupId, studentId, teacherId, recordDate, note, status }) {
  const sets = []; const params = []
  if (groupId    !== undefined) { sets.push('group_id = ?');    params.push(groupId) }
  if (studentId  !== undefined) { sets.push('student_id = ?');  params.push(studentId) }
  if (teacherId  !== undefined) { sets.push('teacher_id = ?');  params.push(teacherId || null) }
  if (recordDate !== undefined) { sets.push('record_date = ?'); params.push(recordDate) }
  if (note       !== undefined) { sets.push('note = ?');        params.push(note || '') }
  if (status     !== undefined) { sets.push('status = ?');      params.push(status) }
  if (!sets.length) return false
  params.push(id, tenantId)
  const [res] = await pool.query(`UPDATE group_records SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params)
  return res.affectedRows > 0
}

export async function deleteGroupRecord(tenantId, id) {
  const [res] = await pool.query('DELETE FROM group_records WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}

// ── Group Members（應到名單） ─────────────────────────────────────────────────

export async function listGroupMembers(tenantId, groupId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.name
       FROM group_members gm
       JOIN students s ON s.id = gm.student_id AND s.tenant_id = ?
      WHERE gm.group_id = ?
      ORDER BY s.name ASC, s.id ASC`,
    [tenantId, groupId]
  )
  return rows
}

export async function setGroupMembers(tenantId, groupId, studentIds) {
  const cleaned = Array.from(new Set((studentIds || []).filter(Boolean)))
  const [existRows] = await pool.query(
    'SELECT student_id FROM group_members WHERE group_id = ? AND tenant_id = ?',
    [groupId, tenantId]
  )
  const existingSet = new Set(existRows.map(r => r.student_id))
  const newlyAdded = cleaned.filter(sid => !existingSet.has(sid))

  await pool.query('DELETE FROM group_members WHERE group_id = ? AND tenant_id = ?', [groupId, tenantId])
  if (cleaned.length) {
    const values = cleaned.map(sid => [groupId, sid, tenantId])
    await pool.query('INSERT INTO group_members (group_id, student_id, tenant_id) VALUES ?', [values])
  }

  for (const sid of newlyAdded) {
    try { await backfillGroupRecordsForStudent(tenantId, groupId, sid) }
    catch (e) { console.error('[backfillGroupRecords] failed:', groupId, sid, e) }
  }
}

// ── Share Tokens ──────────────────────────────────────────────────────────────

export async function insertShareToken(tenantId, { id, token, studentId, periodFrom, periodTo, expiresAt }) {
  await pool.query(
    `INSERT INTO share_tokens (id, tenant_id, token, student_id, period_from, period_to, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, token, studentId, periodFrom, periodTo, expiresAt]
  )
}

export async function getShareTokenByToken(token) {
  const [rows] = await pool.query(
    `SELECT st.id, st.token, st.tenant_id, st.student_id, s.name AS student_name,
            st.period_from, st.period_to, st.expires_at
     FROM share_tokens st
     JOIN students s ON s.id = st.student_id AND s.tenant_id = st.tenant_id
     WHERE st.token = ?`,
    [token]
  )
  return rows[0] || null
}

export async function getStudentBill(tenantId, studentId, from, to) {
  // 家教課：先抓區間內 *所有* lessons（不只該生）以計算「同日同課同師」實際人數
  const [allLessonRows] = await pool.query(
    `SELECT lr.student_id, lr.teacher_id, lr.lesson_date, lr.hours, lr.unit_price, lr.note,
            c.id AS course_id, c.name AS course_name, c.hourly_rate AS course_hourly_rate, c.discount_per_student AS course_discount_per_student,
            t.name AS teacher_name
     FROM lesson_records lr
     JOIN courses  c ON c.id = lr.course_id AND c.tenant_id = lr.tenant_id
     LEFT JOIN teachers t ON t.id = lr.teacher_id AND t.tenant_id = lr.tenant_id
     WHERE lr.tenant_id = ? AND lr.lesson_date >= ? AND lr.lesson_date <= ?
     ORDER BY lr.lesson_date ASC`,
    [tenantId, from, to]
  )
  const sessionStudents = buildSessionStudents(allLessonRows)
  const lessonRows = allLessonRows.filter(r => r.student_id === studentId)

  const courseMap = new Map()
  let total = 0
  const lessons = lessonRows.map(row => {
    const unit = priceForLessonRecord(row, sessionStudents)
    const hours = parseFloat(row.hours)
    const amount = Math.round(hours * unit)
    total += amount
    const key = `${row.course_id}::${unit}`
    if (!courseMap.has(key)) {
      courseMap.set(key, { course_id: row.course_id, course_name: row.course_name, total_hours: 0, unit_price: unit, amount: 0 })
    }
    const entry = courseMap.get(key)
    entry.total_hours = Math.round((entry.total_hours + hours) * 100) / 100
    entry.amount = Math.round(entry.total_hours * entry.unit_price)
    return {
      lesson_date: row.lesson_date,
      course_name: row.course_name,
      teacher_name: row.teacher_name,
      hours, unit_price: unit, amount,
      note: row.note,
    }
  })

  // 團課（鏡像 settlementTuition：按出席月份數 × 月費）
  const [groupRows] = await pool.query(
    `SELECT gr.group_id, g.name AS group_name, g.monthly_fee,
            COUNT(DISTINCT DATE_FORMAT(gr.record_date, '%Y-%m')) AS billable_months
     FROM group_records gr
     JOIN \`groups\` g ON g.id = gr.group_id AND g.tenant_id = gr.tenant_id
     WHERE gr.tenant_id = ? AND gr.student_id = ? AND gr.record_date >= ? AND gr.record_date <= ?
     GROUP BY gr.group_id, g.name, g.monthly_fee
     ORDER BY g.name ASC`,
    [tenantId, studentId, from, to]
  )
  const groups = groupRows.map(row => {
    const months = parseInt(row.billable_months, 10)
    const monthly = parseFloat(row.monthly_fee)
    const amount = Math.round(months * monthly)
    total += amount
    return { group_id: row.group_id, group_name: row.group_name, billable_months: months, monthly_fee: monthly, amount }
  })

  // 教材
  const [materialRows] = await pool.query(
    `SELECT mr.record_date, mr.quantity, mr.note,
            m.id AS material_id, m.name AS material_name, m.unit_price
     FROM material_records mr
     JOIN materials m ON m.id = mr.material_id AND m.tenant_id = mr.tenant_id
     WHERE mr.tenant_id = ? AND mr.student_id = ? AND mr.record_date >= ? AND mr.record_date <= ?
     ORDER BY mr.record_date ASC`,
    [tenantId, studentId, from, to]
  )
  const materialMap = new Map()
  for (const row of materialRows) {
    const qty = parseFloat(row.quantity)
    const price = parseFloat(row.unit_price)
    const amount = Math.round(qty * price)
    total += amount
    if (!materialMap.has(row.material_id)) {
      materialMap.set(row.material_id, { material_id: row.material_id, material_name: row.material_name, total_qty: 0, unit_price: price, amount: 0 })
    }
    const entry = materialMap.get(row.material_id)
    entry.total_qty = Math.round((entry.total_qty + qty) * 100) / 100
    entry.amount = Math.round(entry.total_qty * entry.unit_price)
  }

  return {
    courses: Array.from(courseMap.values()),
    groups,
    materials: Array.from(materialMap.values()),
    lessons,
    total,
  }
}

// ── Payment Records ───────────────────────────────────────────────────────────

export async function listPaymentRecords(tenantId, { from, to } = {}) {
  const conditions = ['pr.tenant_id = ?']; const params = [tenantId]
  if (from) { conditions.push('pr.period_from >= ?'); params.push(from) }
  if (to)   { conditions.push('pr.period_to <= ?');   params.push(to) }
  const where = 'WHERE ' + conditions.join(' AND ')
  const [rows] = await pool.query(
    `SELECT pr.id, pr.student_id, s.name AS student_name,
            pr.period_from, pr.period_to, pr.paid_at, pr.note
     FROM payment_records pr
     JOIN students s ON s.id = pr.student_id AND s.tenant_id = pr.tenant_id
     ${where}
     ORDER BY pr.paid_at DESC`,
    params
  )
  return rows
}

export async function insertPaymentRecord(tenantId, { id, studentId, periodFrom, periodTo, note }) {
  await pool.query(
    `INSERT INTO payment_records (id, tenant_id, student_id, period_from, period_to, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, tenantId, studentId, periodFrom, periodTo, note || '']
  )
}

export async function deletePaymentRecord(tenantId, id) {
  const [res] = await pool.query('DELETE FROM payment_records WHERE id = ? AND tenant_id = ?', [id, tenantId])
  return res.affectedRows > 0
}
