import express from 'express'
import {
  initSchema,
  listStudents,
  insertStudent,
  updateStudentName,
  deleteStudent,
  getAppState,
  setAppState,
} from './db.js'

const STATE_KEYS = {
  'month-projects': 'month_projects_state',
  catalog: 'course_catalog',
}

const PORT = parseInt(process.env.PORT || '3100', 10)
const MAX_STATE_BYTES = parseInt(process.env.MAX_STATE_BYTES || String(2 * 1024 * 1024), 10)

function createRosterId() {
  return `sr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

await initSchema()

const app = express()
app.use(express.json({ limit: `${Math.ceil(MAX_STATE_BYTES / 1024)}kb`, strict: false }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/students', async (_req, res) => {
  try {
    const rows = await listStudents()
    res.json(rows)
  } catch (e) {
    console.error('GET /api/students', e)
    res.status(500).json({ error: 'failed_to_list' })
  }
})

app.post('/api/students', async (req, res) => {
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  const id = createRosterId()
  try {
    await insertStudent({ id, name })
    res.status(201).json({ id, name })
  } catch (e) {
    console.error('POST /api/students', e)
    res.status(500).json({ error: 'failed_to_insert' })
  }
})

app.patch('/api/students/:id', async (req, res) => {
  const id = req.params.id
  const name = normalizeName(req.body?.name)
  if (!name) return res.status(400).json({ error: 'name_required' })
  try {
    const ok = await updateStudentName(id, name)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.json({ id, name })
  } catch (e) {
    console.error('PATCH /api/students/:id', e)
    res.status(500).json({ error: 'failed_to_update' })
  }
})

app.delete('/api/students/:id', async (req, res) => {
  const id = req.params.id
  try {
    const ok = await deleteStudent(id)
    if (!ok) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (e) {
    console.error('DELETE /api/students/:id', e)
    res.status(500).json({ error: 'failed_to_delete' })
  }
})

function stateRoute(apiName) {
  const dbKey = STATE_KEYS[apiName]
  app.get(`/api/${apiName}`, async (_req, res) => {
    try {
      const value = await getAppState(dbKey)
      res.json(value)
    } catch (e) {
      console.error(`GET /api/${apiName}`, e)
      res.status(500).json({ error: 'failed_to_read' })
    }
  })
  app.put(`/api/${apiName}`, async (req, res) => {
    const value = req.body
    if (value === undefined) {
      return res.status(400).json({ error: 'body_required' })
    }
    try {
      await setAppState(dbKey, value)
      res.status(204).end()
    } catch (e) {
      console.error(`PUT /api/${apiName}`, e)
      res.status(500).json({ error: 'failed_to_write' })
    }
  })
}

stateRoute('month-projects')
stateRoute('catalog')

app.listen(PORT, () => {
  console.log(`[tuition-calculator-backend] listening on :${PORT}`)
})
