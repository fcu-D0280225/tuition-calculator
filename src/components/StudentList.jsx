import { sumStudentCoursesSubtotal } from '../data/pricingDefaults'

export default function StudentList({
  students,
  selectedRosterId,
  onSelect,
  unitDraft,
  searchQuery = '',
  rosterCount,
  rosterAddCandidates = [],
  onAddRosterToProject,
}) {
  const subjects = s => [...new Set(s.courses.map(c => c.subject))].join('・')
  const total = s => sumStudentCoursesSubtotal(s, unitDraft)
  const emptyHint =
    rosterAddCandidates.length > 0
      ? '本專案無符合搜尋的學生，下方可從名冊加入'
      : (rosterCount ?? students.length) === 0
        ? '尚無學生，請於上方「新增學生」或從名冊加入'
        : '找不到符合的學生'

  return (
    <ul className="student-list">
      {students.map(s => (
        <li
          key={s.rosterId}
          className={`student-item ${s.rosterId === selectedRosterId ? 'active' : ''}`}
          onClick={() => onSelect(s.rosterId)}
        >
          <div className="student-name">{s.name}</div>
          <div className="student-meta">
            <span className="subject-tags">{subjects(s)}</span>
            <span className="student-total">$ {total(s).toLocaleString()}</span>
          </div>
        </li>
      ))}
      {rosterAddCandidates.length > 0 && (
        <>
          <li className="student-list-divider" aria-hidden="true">
            <span className="student-list-divider-text">
              名冊 · 尚未加入本專案（{rosterAddCandidates.length}）
            </span>
          </li>
          {rosterAddCandidates.map(r => (
            <li
              key={`add-roster-${r.id}`}
              className="student-item student-item--add-from-roster"
            >
              <div className="student-item--add-from-roster-main">
                <div className="student-name">{r.name}</div>
                <span className="student-roster-tag">名冊</span>
              </div>
              <button
                type="button"
                className="btn-add-from-roster"
                onClick={e => {
                  e.stopPropagation()
                  onAddRosterToProject?.(r.id)
                }}
              >
                加入本專案
              </button>
            </li>
          ))}
        </>
      )}
      {students.length === 0 && rosterAddCandidates.length === 0 && (
        <li className="no-results">{searchQuery.trim() ? '找不到符合的學生或名冊' : emptyHint}</li>
      )}
    </ul>
  )
}
