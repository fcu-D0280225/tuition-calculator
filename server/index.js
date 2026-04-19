import express from 'express'
import {
  initSchema,
  // students
  listStudents, insertStudent, updateStudentName, deleteStudent,
  // teachers
  listTeachers, insertTeacher, updateTeacherName, deleteTeacher,
  // courses
  listCourses, insertCourse, updateCourse, deleteCourse,
  // lessons
  listLessons, insertLesson, updateLesson, deleteLesson,
  // materials
  listMaterials, insertMaterial, updateMaterial, deleteMaterial,
  listMaterialRecords, insertMaterialRecord, updateMaterialRecord, deleteMaterialRecord,
  // groups
  listGroups, insertGroup, updateGroup, deleteGroup,
  listGroupRecords, insertGroupRecord, updateGroupRecord, deleteGroupRecord,
  // settlement
  settlementTuition, settlementSalary,
} from './db.js'

const PORT = parseInt(process.env.PORT || '3100', 10)

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

await initSchema()

const app = express()
app.use(express.json({ limit: '2mb' }))

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── Students ──────────────────────────────────────────────────────────────────

app.get('/api/students', async (_req, res) => {
  try { res.json(await listStudents()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/students', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const id = genId('sr')
  try { await insertStudent({ id, name }); res.status(201).json({ id, name }) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/students/:id', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  try {
    const ok = await updateStudentName(req.params.id, name)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, name })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/students/:id', async (req, res) => {
  try {
    const ok = await deleteStudent(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})


// ── Teachers ──────────────────────────────────────────────────────────────────

app.get('/api/teachers', async (_req, res) => {
  try { res.json(await listTeachers()) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/teachers', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const id = genId('tr')
  try { await insertTeacher({ id, name }); res.status(201).json({ id, name }) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/teachers/:id', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  try {
    const ok = await updateTeacherName(req.params.id, name)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, name })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/teachers/:id', async (req, res) => {
  try {
    const ok = await deleteTeacher(req.params.id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
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
  const id = genId('cr')
  try { await insertCourse({ id, name, hourlyRate }); res.status(201).json({ id, name, hourly_rate: hourlyRate }) }
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

// ── Lesson Records ────────────────────────────────────────────────────────────

app.get('/api/lessons', async (req, res) => {
  const { from, to, student_id, teacher_id, course_id } = req.query
  try {
    const rows = await listLessons({ from, to, studentId: student_id, teacherId: teacher_id, courseId: course_id })
    res.json(rows)
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/lessons', async (req, res) => {
  const { student_id, course_id, teacher_id, hours, lesson_date, unit_price, note } = req.body || {}
  if (!student_id || !course_id || !teacher_id) return res.status(400).json({ error: 'student_id_course_id_teacher_id_required' })
  const parsedHours = parseFloat(hours)
  if (isNaN(parsedHours) || parsedHours <= 0) return res.status(400).json({ error: 'invalid_hours' })
  if (!lesson_date || !/^\d{4}-\d{2}-\d{2}$/.test(lesson_date)) return res.status(400).json({ error: 'invalid_lesson_date' })
  const parsedPrice = unit_price !== undefined && unit_price !== '' ? parseFloat(unit_price) : null
  if (parsedPrice !== null && (isNaN(parsedPrice) || parsedPrice < 0)) return res.status(400).json({ error: 'invalid_unit_price' })
  const id = genId('lr')
  try {
    await insertLesson({ id, studentId: student_id, courseId: course_id, teacherId: teacher_id, hours: parsedHours, lessonDate: lesson_date, unitPrice: parsedPrice, note })
    res.status(201).json({ id, student_id, course_id, teacher_id, hours: parsedHours, lesson_date, unit_price: parsedPrice, note: note || '' })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/lessons/:id', async (req, res) => {
  const { student_id, course_id, teacher_id, hours, lesson_date, unit_price, note } = req.body || {}
  const update = {}
  if (student_id  !== undefined) update.studentId  = student_id
  if (course_id   !== undefined) update.courseId   = course_id
  if (teacher_id  !== undefined) update.teacherId  = teacher_id
  if (hours       !== undefined) update.hours      = parseFloat(hours)
  if (lesson_date !== undefined) update.lessonDate = lesson_date
  if (unit_price  !== undefined) update.unitPrice  = unit_price === '' ? null : parseFloat(unit_price)
  if (note        !== undefined) update.note       = note
  try {
    const ok = await updateLesson(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/lessons/:id', async (req, res) => {
  try {
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
  const note = typeof req.body?.note === 'string' ? req.body.note : ''
  const id = genId('gr')
  try {
    await insertGroup({ id, name, weekdays, durationMonths, note })
    res.status(201).json({ id, name, weekdays, duration_months: durationMonths, note })
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
  if (req.body?.note !== undefined) {
    update.note = typeof req.body.note === 'string' ? req.body.note : ''
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

// ── Group Records ─────────────────────────────────────────────────────────────

app.get('/api/group-records', async (req, res) => {
  const { from, to, group_id, student_id } = req.query
  try { res.json(await listGroupRecords({ from, to, groupId: group_id, studentId: student_id })) }
  catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.post('/api/group-records', async (req, res) => {
  const { group_id, student_id, record_date, note } = req.body || {}
  if (!group_id || !student_id) return res.status(400).json({ error: 'group_id_and_student_id_required' })
  if (!record_date || !/^\d{4}-\d{2}-\d{2}$/.test(record_date)) return res.status(400).json({ error: 'invalid_record_date' })
  const id = genId('grr')
  try {
    await insertGroupRecord({ id, groupId: group_id, studentId: student_id, recordDate: record_date, note })
    res.status(201).json({ id, group_id, student_id, record_date, note: note || '' })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.patch('/api/group-records/:id', async (req, res) => {
  const { group_id, student_id, record_date, note } = req.body || {}
  const update = {}
  if (group_id    !== undefined) update.groupId    = group_id
  if (student_id  !== undefined) update.studentId  = student_id
  if (record_date !== undefined) update.recordDate = record_date
  if (note        !== undefined) update.note       = note
  try {
    const ok = await updateGroupRecord(req.params.id, update)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id: req.params.id, ...req.body })
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }) }
})

app.delete('/api/group-records/:id', async (req, res) => {
  try {
    const ok = await deleteGroupRecord(req.params.id)
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

// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[tuition-calculator-backend] listening on :${PORT}`)
})
