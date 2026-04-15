import { INITIAL_STUDENTS } from './students'
import { DEFAULT_UNIT_PRICES } from './pricingDefaults'
import { createRosterId } from './studentRoster'

export const MONTH_PROJECTS_STORAGE_KEY = 'tuition-calculator-month-projects-v1'

const STATE_VERSION = 2

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

export function createMonthProjectId() {
  return `mp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function defaultPeriodLabel() {
  const now = new Date()
  return `${now.getFullYear()}年${now.getMonth() + 1}月`
}

function normalizeUnitDefaults(raw) {
  const base = { ...DEFAULT_UNIT_PRICES }
  if (!raw || typeof raw !== 'object') return base
  for (const k of Object.keys(DEFAULT_UNIT_PRICES)) {
    const n = Number(raw[k])
    if (Number.isFinite(n) && n >= 0) base[k] = n
  }
  return base
}

function normalizeRosterEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createRosterId()
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null
  return { id, name }
}

/** 專案內學生：必須有 rosterId + courses；name 僅作舊資料相容，載入後不再依賴 */
function normalizeProjectStudent(raw, rosterPush) {
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.courses)) return null
  let rosterId = typeof raw.rosterId === 'string' && raw.rosterId.trim() ? raw.rosterId.trim() : ''
  const legacyName = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!rosterId) {
    rosterId = createRosterId()
    const n = legacyName || '未命名'
    rosterPush({ id: rosterId, name: n })
  } else if (legacyName && rosterPush) {
    rosterPush({ id: rosterId, name: legacyName })
  }
  const { courses, ...rest } = raw
  void rest
  return { rosterId, courses }
}

function dedupeRoster(entries) {
  const seen = new Set()
  const out = []
  for (const e of entries) {
    if (!e || seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e)
  }
  return out
}

/** 專案內出現的 rosterId 在名冊中皆須有條目，避免孤兒 id */
function ensureRosterCoversProjects(projects, studentRoster) {
  const roster = [...studentRoster]
  const byId = new Set(roster.map(r => r.id))
  for (const p of projects) {
    for (const s of p.students || []) {
      const rid = s.rosterId
      if (typeof rid === 'string' && rid && !byId.has(rid)) {
        byId.add(rid)
        roster.push({ id: rid, name: '（請至名冊改名）' })
      }
    }
  }
  return dedupeRoster(roster)
}

function migrateToV2(parsed) {
  const rosterAcc = []
  const rosterById = new Map()

  function rosterPush(entry) {
    const n = normalizeRosterEntry(entry)
    if (!n) return
    if (!rosterById.has(n.id)) {
      rosterById.set(n.id, n)
      rosterAcc.push(n)
    } else {
      const prev = rosterById.get(n.id)
      if (n.name && (!prev.name || prev.name === '未命名')) prev.name = n.name
    }
  }

  const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
    .map(proj => {
      if (!proj || typeof proj !== 'object') return null
      const id = typeof proj.id === 'string' && proj.id ? proj.id : createMonthProjectId()
      const label =
        typeof proj.label === 'string' && proj.label.trim()
          ? proj.label.trim()
          : defaultPeriodLabel()
      const unitDefaults = normalizeUnitDefaults(proj.unitDefaults)
      const students = Array.isArray(proj.students)
        ? proj.students
            .map(s => normalizeProjectStudent(s, rosterPush))
            .filter(Boolean)
        : []
      return { id, label, students, unitDefaults }
    })
    .filter(Boolean)

  let studentRoster = Array.isArray(parsed.studentRoster)
    ? parsed.studentRoster.map(normalizeRosterEntry).filter(Boolean)
    : []

  for (const e of rosterAcc) {
    if (!studentRoster.some(r => r.id === e.id)) studentRoster.push(e)
  }
  studentRoster = dedupeRoster(studentRoster)

  let activeProjectId =
    typeof parsed.activeProjectId === 'string' ? parsed.activeProjectId : projects[0]?.id
  if (projects.length && !projects.some(p => p.id === activeProjectId)) activeProjectId = projects[0].id

  const studentRosterFixed = ensureRosterCoversProjects(projects, studentRoster)
  return { version: STATE_VERSION, activeProjectId, projects, studentRoster: studentRosterFixed }
}

function makeRosterPusher(studentRosterArray) {
  const byId = new Map(studentRosterArray.map(r => [r.id, r]))
  return function rosterPush(entry) {
    const n = normalizeRosterEntry(entry)
    if (!n) return
    if (!byId.has(n.id)) {
      byId.set(n.id, n)
      studentRosterArray.push(n)
    } else if (n.name) {
      const prev = byId.get(n.id)
      if (prev && (!prev.name || prev.name === '未命名')) prev.name = n.name
    }
  }
}

function normalizeLoadedState(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  if (parsed.version === STATE_VERSION && Array.isArray(parsed.studentRoster)) {
    const studentRoster = dedupeRoster(
      parsed.studentRoster.map(normalizeRosterEntry).filter(Boolean)
    )
    const rosterPush = makeRosterPusher(studentRoster)
    const projects = Array.isArray(parsed.projects)
      ? parsed.projects
          .map(p => {
            if (!p || typeof p !== 'object') return null
            const id = typeof p.id === 'string' && p.id ? p.id : createMonthProjectId()
            const label =
              typeof p.label === 'string' && p.label.trim()
                ? p.label.trim()
                : defaultPeriodLabel()
            const unitDefaults = normalizeUnitDefaults(p.unitDefaults)
            const students = Array.isArray(p.students)
              ? p.students.map(s => normalizeProjectStudent(s, rosterPush)).filter(Boolean)
              : []
            return { id, label, students, unitDefaults }
          })
          .filter(Boolean)
      : []
    if (projects.length === 0) return null
    let activeProjectId =
      typeof parsed.activeProjectId === 'string' ? parsed.activeProjectId : projects[0].id
    if (!projects.some(p => p.id === activeProjectId)) activeProjectId = projects[0].id
    const sr = dedupeRoster(studentRoster)
    return {
      activeProjectId,
      projects,
      studentRoster: ensureRosterCoversProjects(projects, sr),
    }
  }
  return migrateToV2(parsed)
}

/** @param {{ label?: string, students?: unknown[], unitDefaults?: object }} opts */
export function createNewMonthProject(opts = {}) {
  const label = (opts.label && String(opts.label).trim()) || defaultPeriodLabel()
  const noop = () => {}
  const students = Array.isArray(opts.students)
    ? opts.students.map(s => normalizeProjectStudent(s, noop)).filter(Boolean)
    : []
  const unitDefaults = normalizeUnitDefaults(opts.unitDefaults)
  return {
    id: createMonthProjectId(),
    label,
    students,
    unitDefaults,
  }
}

export function initialProjectsBootstrap() {
  const studentRoster = []
  const students = INITIAL_STUDENTS.map(s => {
    const id = createRosterId()
    studentRoster.push({ id, name: s.name })
    return { rosterId: id, courses: deepClone(s.courses) }
  })
  const p = createNewMonthProject({
    label: defaultPeriodLabel(),
    students,
    unitDefaults: { ...DEFAULT_UNIT_PRICES },
  })
  return { activeProjectId: p.id, projects: [p], studentRoster }
}

/** @returns {{ activeProjectId: string, projects: object[], studentRoster: object[] } | null} */
export function loadMonthProjectsState() {
  try {
    const raw = localStorage.getItem(MONTH_PROJECTS_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    const normalized = normalizeLoadedState(data)
    if (!normalized || !Array.isArray(normalized.projects) || normalized.projects.length === 0)
      return null
    return normalized
  } catch {
    return null
  }
}

/** @param {{ activeProjectId: string, projects: object[], studentRoster: object[] }} state */
export function saveMonthProjectsState(state) {
  try {
    const studentRoster = Array.isArray(state.studentRoster)
      ? dedupeRoster(state.studentRoster.map(normalizeRosterEntry).filter(Boolean))
      : []
    localStorage.setItem(
      MONTH_PROJECTS_STORAGE_KEY,
      JSON.stringify({
        version: STATE_VERSION,
        activeProjectId: state.activeProjectId,
        projects: state.projects,
        studentRoster,
      })
    )
  } catch (e) {
    console.error('saveMonthProjectsState', e)
  }
}
