import { DEFAULT_UNIT_PRICES } from './pricingDefaults'
import { createRosterId } from './studentRoster'
import { apiGetMonthProjects, apiPutMonthProjects } from './api'

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

/** 專案內學生：必須有 rosterId + courses；legacy name 一律忽略（名冊在 DB） */
function normalizeProjectStudent(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!Array.isArray(raw.courses)) return null
  const rosterId =
    typeof raw.rosterId === 'string' && raw.rosterId.trim()
      ? raw.rosterId.trim()
      : createRosterId()
  return { rosterId, courses: raw.courses }
}

function normalizeProject(proj) {
  if (!proj || typeof proj !== 'object') return null
  const id = typeof proj.id === 'string' && proj.id ? proj.id : createMonthProjectId()
  const label =
    typeof proj.label === 'string' && proj.label.trim()
      ? proj.label.trim()
      : defaultPeriodLabel()
  const unitDefaults = normalizeUnitDefaults(proj.unitDefaults)
  const students = Array.isArray(proj.students)
    ? proj.students.map(normalizeProjectStudent).filter(Boolean)
    : []
  return { id, label, students, unitDefaults }
}

function normalizeLoadedState(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
    .map(normalizeProject)
    .filter(Boolean)
  if (projects.length === 0) return null
  let activeProjectId =
    typeof parsed.activeProjectId === 'string' ? parsed.activeProjectId : projects[0].id
  if (!projects.some(p => p.id === activeProjectId)) activeProjectId = projects[0].id
  return { activeProjectId, projects }
}

/** @param {{ label?: string, students?: unknown[], unitDefaults?: object }} opts */
export function createNewMonthProject(opts = {}) {
  const label = (opts.label && String(opts.label).trim()) || defaultPeriodLabel()
  const students = Array.isArray(opts.students)
    ? opts.students.map(normalizeProjectStudent).filter(Boolean)
    : []
  const unitDefaults = normalizeUnitDefaults(opts.unitDefaults)
  return {
    id: createMonthProjectId(),
    label,
    students,
    unitDefaults,
  }
}

/** 無本地資料時的初始狀態：一個空的月份專案，學生名冊改由 API 載入 */
export function initialProjectsBootstrap() {
  const p = createNewMonthProject({
    label: defaultPeriodLabel(),
    students: [],
    unitDefaults: { ...DEFAULT_UNIT_PRICES },
  })
  return { activeProjectId: p.id, projects: [p] }
}

/** @returns {Promise<{ activeProjectId: string, projects: object[] } | null>} */
export async function loadMonthProjectsState() {
  const data = await apiGetMonthProjects()
  return normalizeLoadedState(data)
}

/** @param {{ activeProjectId: string, projects: object[] }} state */
export async function saveMonthProjectsState(state) {
  await apiPutMonthProjects({
    activeProjectId: state.activeProjectId,
    projects: state.projects,
  })
}
