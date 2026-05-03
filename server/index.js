import 'dotenv/config'
import crypto from 'node:crypto'
import express from 'express'
import {
  initSchema,
  // students
  listStudents, insertStudent, updateStudent, setStudentActive, listStudentCourses,
  getStudentEnrollment, setStudentEnrollment, listAllEnrollments, reorderStudents,
  // teachers
  listTeachers, insertTeacher, updateTeacherName, updateTeacher, setTeacherActive, reorderTeachers, listTeacherCourses,
  // courses
  listCourses, insertCourse, updateCourse, deleteCourse, reorderCourses,
  // lessons
  listLessons, insertLesson, updateLesson, deleteLesson, findDuplicateLesson,
  // materials
  listMaterials, insertMaterial, updateMaterial, deleteMaterial,
  listMaterialRecords, insertMaterialRecord, updateMaterialRecord, deleteMaterialRecord,
  // groups
  listGroups, insertGroup, updateGroup, deleteGroup, reorderGroups,
  listGroupRecords, insertGroupRecord, updateGroupRecord, deleteGroupRecord,
  listGroupMembers, setGroupMembers,
  // misc expenses
  listMiscExpenses, insertMiscExpense, deleteMiscExpense, sumMiscExpensesByCategory,
  // material cost
  sumMaterialCost,
  // period locks
  listPeriodLocks, insertPeriodLock, deletePeriodLock,
  isDateLocked, isLessonLocked, isGroupRecordLocked,
  // settlement
  settlementTuition, settlementSalary,
  // share tokens
  insertShareToken, getShareTokenByToken, getStudentBill,
  // payment records
  listPaymentRecords, insertPaymentRecord, deletePaymentRecord,
  // leave requests
  insertLeaveRequest, listStudentLeaveRequests, deleteLeaveRequest,
} from './db.js'
import { initAuthSchema, requireAuth, registerAuthRoutes, registerAdminRoutes } from './auth.js'

const PORT = parseInt(process.env.PORT || '3100', 10)

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function normalizeName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

async function initSchemaWithRetry() {
  const maxAttempts = 30
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await initSchema()
      if (attempt > 1) console.log(`[tuition-calculator-backend] initSchema OK (attempt ${attempt})`)
      return
    } catch (e) {
      if (attempt === maxAttempts) throw e
      const delay = Math.min(2000 * attempt, 15000)
      console.warn(`[tuition-calculator-backend] initSchema failed (attempt ${attempt}/${maxAttempts}): ${e.code || e.message} — retry in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

await initSchemaWithRetry()
await initAuthSchema()

const app = express()
app.use(express.json({ limit: '2mb' }))

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── Auth ──────────────────────────────────────────────────────────────────────

registerAuthRoutes(app)
app.use(requireAuth())
registerAdminRoutes(app)

// ── Students ──────────────────────────────────────────────────────────────────

app.get('/api/students', async (_req, res) => {
  try { res.json(await listStudents()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/students', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const contactName  = typeof req.body?.contact_name  === 'string' ? req.body.contact_name.trim()  : ''
  const contactPhone = typeof req.body?.contact_phone === 'string' ? req.body.contact_phone.trim() : ''
  const id = genId('sr')
  try {
    await insertStudent({ id, name, contactName, contactPhone })
    res.status(201).json({ id, name, contact_name: contactName, contact_phone: contactPhone })
  }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/students/:id', async (req, res) => {
  const update = {}
  if (req.body?.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ error: 'name_required' })
    update.name = name
  }
  if (req.body?.contact_name !== undefined) {
    update.contactName = typeof req.body.contact_name === 'string' ? req.body.contact_name.trim() : ''
  }
  if (req.body?.contact_phone !== undefined) {
    update.contactPhone = typeof req.body.contact_phone === 'string' ? req.body.contact_phone.trim() : ''
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing_to_update' })
  try {
    const ok = await updateStudent(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    const out = { id: req.params.id }
    if (update.name         !== undefined) out.name          = update.name
    if (update.contactName  !== undefined) out.contact_name  = update.contactName
    if (update.contactPhone !== undefined) out.contact_phone = update.contactPhone
    res.json(out)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/students/:id/active', async (req, res) => {
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'active_required' })
  try {
    const ok = await setStudentActive(req.params.id, req.body.active)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, active: req.body.active })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/students/:id/courses', async (req, res) => {
  try { res.json(await listStudentCourses(req.params.id)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/students/:id/enrollment', async (req, res) => {
  try { res.json(await getStudentEnrollment(req.params.id)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/students/:id/enrollment', async (req, res) => {
  const { course_ids, group_ids } = req.body || {}
  if (course_ids !== undefined && !Array.isArray(course_ids)) return res.status(400).json({ error: 'invalid_course_ids' })
  if (group_ids  !== undefined && !Array.isArray(group_ids))  return res.status(400).json({ error: 'invalid_group_ids' })
  try {
    await setStudentEnrollment(req.params.id, { courseIds: course_ids, groupIds: group_ids })
    res.json(await getStudentEnrollment(req.params.id))
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/students/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  if (ids === null || ids.some(id => typeof id !== 'string')) return res.status(400).json({ error: 'ids_required' })
  try {
    await reorderStudents(ids)
    res.json(await listStudents())
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/enrollments', async (_req, res) => {
  try { res.json(await listAllEnrollments()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})


// ── Teachers ──────────────────────────────────────────────────────────────────

app.get('/api/teachers', async (_req, res) => {
  try { res.json(await listTeachers()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/teachers', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const contactPhone = typeof req.body?.contact_phone === 'string' ? req.body.contact_phone.trim() : ''
  const id = genId('tr')
  try {
    await insertTeacher({ id, name, contactPhone })
    res.status(201).json({ id, name, contact_phone: contactPhone })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/teachers/:id', async (req, res) => {
  const update = {}
  if (req.body?.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ error: 'name_required' })
    update.name = name
  }
  if (req.body?.contact_phone !== undefined) {
    update.contactPhone = typeof req.body.contact_phone === 'string' ? req.body.contact_phone.trim() : ''
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing_to_update' })
  try {
    const ok = await updateTeacher(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...update })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/teachers/:id/courses', async (req, res) => {
  try { res.json(await listTeacherCourses(req.params.id)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/teachers/:id/active', async (req, res) => {
  if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'active_required' })
  try {
    const ok = await setTeacherActive(req.params.id, req.body.active)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, active: req.body.active })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/teachers/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  if (ids === null || ids.some(id => typeof id !== 'string')) return res.status(400).json({ error: 'ids_required' })
  try {
    await reorderTeachers(ids)
    res.json(await listTeachers())
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})


// ── Courses ───────────────────────────────────────────────────────────────────

app.get('/api/courses', async (_req, res) => {
  try { res.json(await listCourses()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/courses', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const hourlyRate = req.body?.hourly_rate !== undefined ? parseFloat(req.body.hourly_rate) : 0
  if (isNaN(hourlyRate) || hourlyRate < 0) return res.status(400).json({ error: 'invalid_hourly_rate' })
  const teacherHourlyRate = req.body?.teacher_hourly_rate !== undefined ? parseFloat(req.body.teacher_hourly_rate) : 0
  if (isNaN(teacherHourlyRate) || teacherHourlyRate < 0) return res.status(400).json({ error: 'invalid_teacher_hourly_rate' })
  const discountPerStudent = req.body?.discount_per_student !== undefined ? parseFloat(req.body.discount_per_student) : 0
  if (isNaN(discountPerStudent) || discountPerStudent < 0 || discountPerStudent > 100000) return res.status(400).json({ error: 'invalid_discount_per_student' })
  const defaultTeacherId = req.body?.default_teacher_id != null && req.body.default_teacher_id !== ''
    ? String(req.body.default_teacher_id) : null
  const durationHoursRaw = req.body?.duration_hours
  const durationHours = durationHoursRaw === undefined || durationHoursRaw === '' || durationHoursRaw === null
    ? 1 : parseFloat(durationHoursRaw)
  if (isNaN(durationHours) || durationHours <= 0 || durationHours > 24) return res.status(400).json({ error: 'invalid_duration_hours' })
  const id = genId('cr')
  try {
    await insertCourse({ id, name, hourlyRate, teacherHourlyRate, discountPerStudent, defaultTeacherId, durationHours })
    res.status(201).json({ id, name, hourly_rate: hourlyRate, teacher_hourly_rate: teacherHourlyRate, discount_per_student: discountPerStudent, default_teacher_id: defaultTeacherId, duration_hours: durationHours })
  }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/courses/:id', async (req, res) => {
  const update = {}
  if (req.body?.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ error: 'name_required' })
    update.name = name
  }
  if (req.body?.hourly_rate !== undefined) {
    const hourlyRate = parseFloat(req.body.hourly_rate)
    if (isNaN(hourlyRate) || hourlyRate < 0) return res.status(400).json({ error: 'invalid_hourly_rate' })
    update.hourlyRate = hourlyRate
  }
  if (req.body?.teacher_hourly_rate !== undefined) {
    const teacherHourlyRate = parseFloat(req.body.teacher_hourly_rate)
    if (isNaN(teacherHourlyRate) || teacherHourlyRate < 0) return res.status(400).json({ error: 'invalid_teacher_hourly_rate' })
    update.teacherHourlyRate = teacherHourlyRate
  }
  if (req.body?.discount_per_student !== undefined) {
    const dps = parseFloat(req.body.discount_per_student)
    if (isNaN(dps) || dps < 0 || dps > 100000) return res.status(400).json({ error: 'invalid_discount_per_student' })
    update.discountPerStudent = dps
  }
  if (req.body?.default_teacher_id !== undefined) {
    const v = req.body.default_teacher_id
    update.defaultTeacherId = (v === null || v === '') ? null : String(v)
  }
  if (req.body?.duration_hours !== undefined) {
    const dh = parseFloat(req.body.duration_hours)
    if (isNaN(dh) || dh <= 0 || dh > 24) return res.status(400).json({ error: 'invalid_duration_hours' })
    update.durationHours = dh
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing_to_update' })
  try {
    const ok = await updateCourse(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const ok = await deleteCourse(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/courses/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  if (ids === null || ids.some(id => typeof id !== 'string')) return res.status(400).json({ error: 'ids_required' })
  try {
    await reorderCourses(ids)
    res.json(await listCourses())
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Period Locks ──────────────────────────────────────────────────────────────

app.get('/api/period-locks', async (_req, res) => {
  try { res.json(await listPeriodLocks()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/period-locks', async (req, res) => {
  const period_from = req.body?.period_from
  const period_to   = req.body?.period_to
  if (!period_from || !/^\d{4}-\d{2}-\d{2}$/.test(period_from)) return res.status(400).json({ error: 'invalid_period_from' })
  if (!period_to   || !/^\d{4}-\d{2}-\d{2}$/.test(period_to))   return res.status(400).json({ error: 'invalid_period_to' })
  if (period_from > period_to) return res.status(400).json({ error: 'invalid_range' })
  const note = typeof req.body?.note === 'string' ? req.body.note : ''
  const id = `lock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  try {
    await insertPeriodLock({ id, periodFrom: period_from, periodTo: period_to, note })
    res.status(201).json({ id, period_from, period_to, note })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/period-locks/:id', async (req, res) => {
  try {
    const ok = await deletePeriodLock(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Misc Expenses ─────────────────────────────────────────────────────────────

app.get('/api/misc-expenses', async (req, res) => {
  const { from, to, category } = req.query
  try { res.json(await listMiscExpenses({ from, to, category })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/misc-expenses/summary', async (req, res) => {
  const { from, to } = req.query
  try { res.json(await sumMiscExpensesByCategory({ from, to })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/misc-expenses', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
  if (!name) return res.status(400).json({ error: 'name_required' })
  const amount = parseFloat(req.body?.amount)
  if (isNaN(amount) || amount < 0) return res.status(400).json({ error: 'invalid_amount' })
  const expense_date = req.body?.expense_date
  if (!expense_date || !/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) return res.status(400).json({ error: 'invalid_expense_date' })
  const note = typeof req.body?.note === 'string' ? req.body.note : ''
  const category = typeof req.body?.category === 'string' && req.body.category.trim() ? req.body.category.trim() : '其他'
  const id = `me_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  try {
    await insertMiscExpense({ id, name, category, amount, expenseDate: expense_date, note })
    res.status(201).json({ id, name, category, amount, expense_date, note })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/misc-expenses/:id', async (req, res) => {
  try {
    const ok = await deleteMiscExpense(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Lesson Records ────────────────────────────────────────────────────────────

app.get('/api/lessons', async (req, res) => {
  const { from, to, student_id, teacher_id, course_id } = req.query
  // 老師帳號（非 admin 且綁了 teacher_id）：強制只看自己的課
  const enforcedTeacherId = (!req.user?.is_admin && req.user?.teacher_id) ? req.user.teacher_id : teacher_id
  try {
    const rows = await listLessons({ from, to, studentId: student_id, teacherId: enforcedTeacherId, courseId: course_id })
    res.json(rows)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/lessons', async (req, res) => {
  const { student_id, course_id, teacher_id, hours, lesson_date, start_time, unit_price, teacher_unit_price, note, status } = req.body || {}
  if (!student_id || !course_id) return res.status(400).json({ error: 'student_id_course_id_required' })
  const teacherId = (teacher_id === undefined || teacher_id === null || teacher_id === '') ? null : String(teacher_id)
  const parsedHours = parseFloat(hours)
  if (isNaN(parsedHours) || parsedHours <= 0) return res.status(400).json({ error: 'invalid_hours' })
  if (!lesson_date || !/^\d{4}-\d{2}-\d{2}$/.test(lesson_date)) return res.status(400).json({ error: 'invalid_lesson_date' })
  const parsedPrice = (unit_price === undefined || unit_price === null || unit_price === '') ? null : parseFloat(unit_price)
  if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) return res.status(400).json({ error: 'invalid_unit_price' })
  const parsedTeacherPrice = (teacher_unit_price === undefined || teacher_unit_price === null || teacher_unit_price === '') ? null : parseFloat(teacher_unit_price)
  if (parsedTeacherPrice !== null && (isNaN(parsedTeacherPrice) || parsedTeacherPrice < 0)) return res.status(400).json({ error: 'invalid_teacher_unit_price' })
  const cleanStart = start_time && /^\d{2}:\d{2}(:\d{2})?$/.test(start_time) ? start_time : null
  if (await isDateLocked(lesson_date)) return res.status(423).json({ error: 'period_locked' })
  if (!req.body?.force) {
    const dups = await findDuplicateLesson({ studentId: student_id, courseId: course_id, lessonDate: lesson_date })
    if (dups.length > 0) {
      return res.status(409).json({ error: 'duplicate_lesson', existing: dups })
    }
  }
  const id = genId('lr')
  try {
    await insertLesson({ id, studentId: student_id, courseId: course_id, teacherId, hours: parsedHours, lessonDate: lesson_date, startTime: cleanStart, unitPrice: parsedPrice, teacherUnitPrice: parsedTeacherPrice, note, status })
    res.status(201).json({ id, student_id, course_id, teacher_id: teacherId, hours: parsedHours, lesson_date, start_time: cleanStart, unit_price: parsedPrice, teacher_unit_price: parsedTeacherPrice, note: note || '', status: status || 'pending' })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/lessons/:id', async (req, res) => {
  const { student_id, course_id, teacher_id, hours, lesson_date, start_time, unit_price, teacher_unit_price, note, status } = req.body || {}
  const update = {}
  if (student_id        !== undefined) update.studentId        = student_id
  if (course_id         !== undefined) update.courseId         = course_id
  if (teacher_id        !== undefined) update.teacherId        = teacher_id
  if (hours             !== undefined) update.hours            = parseFloat(hours)
  if (lesson_date       !== undefined) update.lessonDate       = lesson_date
  if (start_time        !== undefined) update.startTime        = (start_time && /^\d{2}:\d{2}(:\d{2})?$/.test(start_time)) ? start_time : null
  if (unit_price        !== undefined) update.unitPrice        = (unit_price === null || unit_price === '') ? null : parseFloat(unit_price)
  if (teacher_unit_price !== undefined) update.teacherUnitPrice = (teacher_unit_price === null || teacher_unit_price === '') ? null : parseFloat(teacher_unit_price)
  if (note              !== undefined) update.note             = note
  if (status            !== undefined) update.status           = status
  try {
    if (await isLessonLocked(req.params.id)) return res.status(423).json({ error: 'period_locked' })
    if (update.lessonDate && await isDateLocked(update.lessonDate)) return res.status(423).json({ error: 'period_locked' })
    const ok = await updateLesson(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/lessons/:id', async (req, res) => {
  try {
    if (await isLessonLocked(req.params.id)) return res.status(423).json({ error: 'period_locked' })
    const ok = await deleteLesson(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Materials ─────────────────────────────────────────────────────────────────

app.get('/api/materials', async (_req, res) => {
  try { res.json(await listMaterials()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/materials', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const unitPrice = req.body?.unit_price !== undefined ? parseFloat(req.body.unit_price) : 0
  if (isNaN(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'invalid_unit_price' })
  const id = genId('mat')
  try { await insertMaterial({ id, name, unitPrice }); res.status(201).json({ id, name, unit_price: unitPrice }) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/materials/:id', async (req, res) => {
  const update = {}
  if (req.body?.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ error: 'name_required' })
    update.name = name
  }
  if (req.body?.unit_price !== undefined) {
    const unitPrice = parseFloat(req.body.unit_price)
    if (isNaN(unitPrice) || unitPrice < 0) return res.status(400).json({ error: 'invalid_unit_price' })
    update.unitPrice = unitPrice
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing_to_update' })
  try {
    const ok = await updateMaterial(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/materials/:id', async (req, res) => {
  try {
    const ok = await deleteMaterial(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Material Records ──────────────────────────────────────────────────────────

app.get('/api/material-records', async (req, res) => {
  const { from, to, student_id } = req.query
  try { res.json(await listMaterialRecords({ from, to, studentId: student_id })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/material-records', async (req, res) => {
  const { student_id, material_id, quantity, record_date, note } = req.body || {}
  if (!student_id || !material_id) return res.status(400).json({ error: 'student_id_and_material_id_required' })
  const qty = quantity !== undefined ? parseFloat(quantity) : 1
  if (isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'invalid_quantity' })
  if (!record_date || !/^\d{4}-\d{2}-\d{2}$/.test(record_date)) return res.status(400).json({ error: 'invalid_record_date' })
  const id = genId('mr')
  try {
    await insertMaterialRecord({ id, studentId: student_id, materialId: material_id, quantity: qty, recordDate: record_date, note })
    res.status(201).json({ id, student_id, material_id, quantity: qty, record_date, note: note || '' })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/material-records/:id', async (req, res) => {
  const { student_id, material_id, quantity, record_date, note } = req.body || {}
  const update = {}
  if (student_id  !== undefined) update.studentId  = student_id
  if (material_id !== undefined) update.materialId = material_id
  if (quantity    !== undefined) update.quantity   = parseFloat(quantity)
  if (record_date !== undefined) update.recordDate = record_date
  if (note        !== undefined) update.note       = note
  try {
    const ok = await updateMaterialRecord(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/material-records/:id', async (req, res) => {
  try {
    const ok = await deleteMaterialRecord(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Groups ────────────────────────────────────────────────────────────────────

function normalizeWeekdays(raw) {
  if (raw === undefined || raw === null) return ''
  const arr = Array.isArray(raw)
    ? raw
    : String(raw).split(',').map(s => s.trim()).filter(Boolean)
  const cleaned = []
  const seen = new Set()
  for (const v of arr) {
    const n = parseInt(v, 10)
    if (!Number.isInteger(n) || n < 0 || n > 6) return null
    if (seen.has(n)) continue
    seen.add(n)
    cleaned.push(n)
  }
  cleaned.sort((a, b) => a - b)
  return cleaned.join(',')
}

app.get('/api/groups', async (_req, res) => {
  try { res.json(await listGroups()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/groups', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const weekdays = normalizeWeekdays(req.body?.weekdays)
  if (weekdays === null) return res.status(400).json({ error: 'invalid_weekdays' })
  const durationMonths = req.body?.duration_months !== undefined ? parseInt(req.body.duration_months, 10) : 0
  if (isNaN(durationMonths) || durationMonths < 0 || durationMonths > 4) return res.status(400).json({ error: 'invalid_duration_months' })
  const monthlyFee = req.body?.monthly_fee !== undefined ? parseFloat(req.body.monthly_fee) : 0
  if (isNaN(monthlyFee) || monthlyFee < 0) return res.status(400).json({ error: 'invalid_monthly_fee' })
  const startTime = req.body?.start_time && /^\d{2}:\d{2}(:\d{2})?$/.test(req.body.start_time) ? req.body.start_time : null
  const durationHours = req.body?.duration_hours !== undefined ? parseFloat(req.body.duration_hours) : 0
  if (isNaN(durationHours) || durationHours < 0 || durationHours > 24) return res.status(400).json({ error: 'invalid_duration_hours' })
  const teacherHourlyRate = req.body?.teacher_hourly_rate !== undefined ? parseFloat(req.body.teacher_hourly_rate) : 0
  if (isNaN(teacherHourlyRate) || teacherHourlyRate < 0) return res.status(400).json({ error: 'invalid_teacher_hourly_rate' })
  const note = typeof req.body?.note === 'string' ? req.body.note : ''
  const defaultTeacherId = req.body?.default_teacher_id != null && req.body.default_teacher_id !== ''
    ? String(req.body.default_teacher_id) : null
  const id = genId('gr')
  try {
    await insertGroup({ id, name, weekdays, durationMonths, monthlyFee, startTime, durationHours, teacherHourlyRate, note, defaultTeacherId })
    res.status(201).json({ id, name, weekdays, duration_months: durationMonths, monthly_fee: monthlyFee, start_time: startTime, duration_hours: durationHours, teacher_hourly_rate: teacherHourlyRate, note, default_teacher_id: defaultTeacherId })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/groups/:id', async (req, res) => {
  const update = {}
  if (req.body?.name !== undefined) {
    const name = normalizeName(req.body.name)
    if (!name) return res.status(400).json({ error: 'name_required' })
    update.name = name
  }
  if (req.body?.weekdays !== undefined) {
    const weekdays = normalizeWeekdays(req.body.weekdays)
    if (weekdays === null) return res.status(400).json({ error: 'invalid_weekdays' })
    update.weekdays = weekdays
  }
  if (req.body?.duration_months !== undefined) {
    const dm = parseInt(req.body.duration_months, 10)
    if (isNaN(dm) || dm < 0 || dm > 4) return res.status(400).json({ error: 'invalid_duration_months' })
    update.durationMonths = dm
  }
  if (req.body?.monthly_fee !== undefined) {
    const mf = parseFloat(req.body.monthly_fee)
    if (isNaN(mf) || mf < 0) return res.status(400).json({ error: 'invalid_monthly_fee' })
    update.monthlyFee = mf
  }
  if (req.body?.start_time !== undefined) {
    const v = req.body.start_time
    update.startTime = (v && /^\d{2}:\d{2}(:\d{2})?$/.test(v)) ? v : null
  }
  if (req.body?.duration_hours !== undefined) {
    const dh = parseFloat(req.body.duration_hours)
    if (isNaN(dh) || dh < 0 || dh > 24) return res.status(400).json({ error: 'invalid_duration_hours' })
    update.durationHours = dh
  }
  if (req.body?.teacher_hourly_rate !== undefined) {
    const thr = parseFloat(req.body.teacher_hourly_rate)
    if (isNaN(thr) || thr < 0) return res.status(400).json({ error: 'invalid_teacher_hourly_rate' })
    update.teacherHourlyRate = thr
  }
  if (req.body?.note !== undefined) {
    update.note = typeof req.body.note === 'string' ? req.body.note : ''
  }
  if (req.body?.default_teacher_id !== undefined) {
    const v = req.body.default_teacher_id
    update.defaultTeacherId = (v === null || v === '') ? null : String(v)
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'nothing_to_update' })
  try {
    const ok = await updateGroup(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...update })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/groups/:id', async (req, res) => {
  try {
    const ok = await deleteGroup(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/groups/reorder', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null
  if (ids === null || ids.some(id => typeof id !== 'string')) return res.status(400).json({ error: 'ids_required' })
  try {
    await reorderGroups(ids)
    res.json(await listGroups())
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Group Records ─────────────────────────────────────────────────────────────

app.get('/api/group-records', async (req, res) => {
  const { from, to, group_id, student_id, teacher_id } = req.query
  const enforcedTeacherId = (!req.user?.is_admin && req.user?.teacher_id) ? req.user.teacher_id : teacher_id
  try { res.json(await listGroupRecords({ from, to, groupId: group_id, studentId: student_id, teacherId: enforcedTeacherId })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/group-records', async (req, res) => {
  const { group_id, student_id, teacher_id, record_date, note, status } = req.body || {}
  if (!group_id || !student_id) return res.status(400).json({ error: 'group_id_and_student_id_required' })
  if (!record_date || !/^\d{4}-\d{2}-\d{2}$/.test(record_date)) return res.status(400).json({ error: 'invalid_record_date' })
  const teacherId = teacher_id ? String(teacher_id) : null
  if (await isDateLocked(record_date)) return res.status(423).json({ error: 'period_locked' })
  const id = genId('grr')
  try {
    await insertGroupRecord({ id, groupId: group_id, studentId: student_id, teacherId, recordDate: record_date, note, status })
    res.status(201).json({ id, group_id, student_id, teacher_id: teacherId, record_date, note: note || '', status: status || 'pending' })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/group-records/:id', async (req, res) => {
  const { group_id, student_id, teacher_id, record_date, note, status } = req.body || {}
  const update = {}
  if (group_id    !== undefined) update.groupId    = group_id
  if (student_id  !== undefined) update.studentId  = student_id
  if (teacher_id  !== undefined) update.teacherId  = (teacher_id === null || teacher_id === '') ? null : String(teacher_id)
  if (record_date !== undefined) update.recordDate = record_date
  if (note        !== undefined) update.note       = note
  if (status      !== undefined) update.status     = status
  try {
    if (await isGroupRecordLocked(req.params.id)) return res.status(423).json({ error: 'period_locked' })
    if (update.recordDate && await isDateLocked(update.recordDate)) return res.status(423).json({ error: 'period_locked' })
    const ok = await updateGroupRecord(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/group-records/:id', async (req, res) => {
  try {
    if (await isGroupRecordLocked(req.params.id)) return res.status(423).json({ error: 'period_locked' })
    const ok = await deleteGroupRecord(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Group Members（應到名單） ─────────────────────────────────────────────────

app.get('/api/groups/:id/members', async (req, res) => {
  try { res.json(await listGroupMembers(req.params.id)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.put('/api/groups/:id/members', async (req, res) => {
  const ids = Array.isArray(req.body?.student_ids) ? req.body.student_ids : null
  if (ids === null) return res.status(400).json({ error: 'student_ids_required' })
  try {
    await setGroupMembers(req.params.id, ids)
    res.json(await listGroupMembers(req.params.id))
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Payment Records ───────────────────────────────────────────────────────────

app.get('/api/payment-records', async (req, res) => {
  const { from, to } = req.query
  try { res.json(await listPaymentRecords({ from, to })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/payment-records', async (req, res) => {
  const { student_id, period_from, period_to, note } = req.body || {}
  if (!student_id) return res.status(400).json({ error: 'student_id_required' })
  if (!period_from || !DATE_RE.test(period_from)) return res.status(400).json({ error: 'invalid_period_from' })
  if (!period_to   || !DATE_RE.test(period_to))   return res.status(400).json({ error: 'invalid_period_to' })
  if (period_from > period_to) return res.status(400).json({ error: 'period_from_after_to' })
  const id = genId('pay')
  try {
    await insertPaymentRecord({ id, studentId: student_id, periodFrom: period_from, periodTo: period_to, note })
    const paid_at = new Date().toISOString().slice(0, 19).replace('T', ' ')
    res.status(201).json({ id, student_id, period_from, period_to, paid_at, note: note || '' })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'already_paid' })
    console.error(e); res.status(500).json({ error: 'failed' })
  }
})

app.delete('/api/payment-records/:id', async (req, res) => {
  try {
    const ok = await deletePaymentRecord(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Settlement ────────────────────────────────────────────────────────────────

app.get('/api/settlement/tuition', async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from_and_to_required' })
  try { res.json(await settlementTuition(from, to)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/settlement/salary', async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from_and_to_required' })
  try { res.json(await settlementSalary(from, to)) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/settlement/profit-loss', async (req, res) => {
  const { from, to } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from_and_to_required' })
  try {
    const [tuition, salary, expensesByCat, materialCost] = await Promise.all([
      settlementTuition(from, to),
      settlementSalary(from, to),
      sumMiscExpensesByCategory({ from, to }),
      sumMaterialCost({ from, to }),
    ])
    const tuitionTotal = (tuition || []).reduce((s, st) => s + parseFloat(st.total || 0), 0)
    const salaryTotal  = (salary  || []).reduce((s, t)  => s + parseFloat(t.total  || 0), 0)
    const expenseTotal = expensesByCat.reduce((s, c) => s + parseFloat(c.total || 0), 0)
    const profit = tuitionTotal - salaryTotal - materialCost - expenseTotal
    res.json({
      from, to,
      revenue: { tuition: tuitionTotal },
      cost:    { salary: salaryTotal, materials: materialCost },
      expenses: {
        by_category: expensesByCat,
        total: expenseTotal,
      },
      profit,
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Leave Requests ────────────────────────────────────────────────────────────

app.get('/api/students/:id/leave-requests', async (req, res) => {
  const { from, to } = req.query
  if (from && !DATE_RE.test(from)) return res.status(400).json({ error: 'invalid_from' })
  if (to   && !DATE_RE.test(to))   return res.status(400).json({ error: 'invalid_to' })
  try { res.json(await listStudentLeaveRequests(req.params.id, { from, to })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/leave-requests', async (req, res) => {
  const { student_id, course_id, leave_date, reason, lesson_record_id } = req.body || {}
  if (!student_id) return res.status(400).json({ error: 'student_id_required' })
  if (!course_id)  return res.status(400).json({ error: 'course_id_required' })
  if (!leave_date || !DATE_RE.test(leave_date)) return res.status(400).json({ error: 'invalid_leave_date' })
  const cleanReason = typeof reason === 'string' ? reason.trim() : ''
  if (!cleanReason) return res.status(400).json({ error: 'reason_required' })
  if (cleanReason.length > 512) return res.status(400).json({ error: 'reason_too_long' })
  const id = genId('lvr')
  try {
    await insertLeaveRequest({ id, studentId: student_id, courseId: course_id, leaveDate: leave_date, reason: cleanReason, lessonRecordId: lesson_record_id || null })
    res.status(201).json({ id, student_id, course_id, leave_date, reason: cleanReason, lesson_record_id: lesson_record_id || null })
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'student_or_course_not_found' })
    console.error(e); res.status(500).json({ error: 'failed' })
  }
})

app.delete('/api/leave-requests/:id', async (req, res) => {
  try {
    const ok = await deleteLeaveRequest(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ── Share Tokens ──────────────────────────────────────────────────────────────

app.post('/api/students/:id/share-token', async (req, res) => {
  const { from, to, expires_days } = req.body || {}
  if (!from || !DATE_RE.test(from)) return res.status(400).json({ error: 'invalid_from' })
  if (!to   || !DATE_RE.test(to))   return res.status(400).json({ error: 'invalid_to' })
  if (from > to) return res.status(400).json({ error: 'from_after_to' })
  const days = expires_days !== undefined ? parseInt(expires_days, 10) : 30
  if (!Number.isFinite(days) || days <= 0 || days > 365) return res.status(400).json({ error: 'invalid_expires_days' })

  const students = await listStudents()
  if (!students.some(s => s.id === req.params.id)) return res.status(404).json({ error: 'student_not_found' })

  const id      = genId('stk')
  const token   = crypto.randomBytes(24).toString('base64url')
  const expires = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 19).replace('T', ' ')
  try {
    await insertShareToken({ id, token, studentId: req.params.id, periodFrom: from, periodTo: to, expiresAt: expires })
    res.status(201).json({ token, from, to, expires_at: expires })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.get('/api/share/:token', async (req, res) => {
  try {
    const row = await getShareTokenByToken(req.params.token)
    if (!row) return res.status(404).json({ error: 'not_found' })
    if (new Date(row.expires_at) < new Date()) return res.status(410).json({ error: 'expired' })
    const bill = await getStudentBill(row.student_id, row.period_from, row.period_to)
    res.json({
      student: { id: row.student_id, name: row.student_name },
      period:  { from: row.period_from, to: row.period_to },
      expires_at: row.expires_at,
      ...bill,
    })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[tuition-calculator-backend] listening on :${PORT}`)
})
