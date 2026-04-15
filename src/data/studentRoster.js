/** 全站學生名冊（與各月專案分離；專案內以 rosterId 對應） */

export function createRosterId() {
  return `sr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** @param {Array<{ id: string, name: string }>} roster */
export function rosterEntriesToMap(roster) {
  const m = new Map()
  for (const e of roster || []) {
    if (e && typeof e.id === 'string' && e.id) {
      m.set(e.id, typeof e.name === 'string' ? e.name.trim() : '')
    }
  }
  return m
}

/**
 * @param {Array<{ rosterId?: string, name?: string, courses: unknown[] }>} students
 * @param {Array<{ id: string, name: string }>} roster
 */
export function attachDisplayNames(students, roster) {
  const map = rosterEntriesToMap(roster)
  return (students || []).map(s => {
    const name = map.get(s.rosterId) || (typeof s.name === 'string' ? s.name : '') || '（未命名）'
    return { ...s, name }
  })
}
