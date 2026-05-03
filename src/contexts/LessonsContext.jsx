import { createContext, useContext, useReducer, useCallback } from 'react'
import { apiListLessons, apiCreateLesson, apiCreateLessonWithDupCheck, apiUpdateLesson, apiDeleteLesson } from '../data/api.js'

const LessonsContext = createContext(null)

function defaultDupConfirm(existing, lesson) {
  const lines = (existing || []).map(r => {
    const t = r.start_time ? String(r.start_time).slice(0, 5) : '未排定時間'
    const teacher = r.teacher_name ? `・${r.teacher_name}` : ''
    return `• ${t}　${r.hours} 小時${teacher}`
  })
  const msg =
    `⚠️ 偵測到當天已有同一學生 + 同一課程的紀錄：\n\n` +
    `日期：${lesson.lesson_date}\n` +
    `${lines.join('\n')}\n\n` +
    `仍要再新增一筆嗎？確定後會出現重複的紀錄。`
  return window.confirm(msg)
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_LESSONS':
      return { ...state, lessons: action.lessons, loading: false }
    case 'ADD_LESSON':
      return { ...state, lessons: [action.lesson, ...state.lessons] }
    case 'UPDATE_LESSON':
      return { ...state, lessons: state.lessons.map(l => l.id === action.lesson.id ? { ...l, ...action.lesson } : l) }
    case 'REMOVE_LESSON':
      return { ...state, lessons: state.lessons.filter(l => l.id !== action.id) }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

export function LessonsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { lessons: [], loading: false })

  const loadLessons = useCallback(async (filters = {}) => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const lessons = await apiListLessons(filters)
    dispatch({ type: 'SET_LESSONS', lessons })
  }, [])

  const createLesson = useCallback(async (lesson) => {
    const created = await apiCreateLessonWithDupCheck(lesson, defaultDupConfirm)
    dispatch({ type: 'ADD_LESSON', lesson: created })
    return created
  }, [])

  const updateLesson = useCallback(async (id, patch) => {
    const updated = await apiUpdateLesson(id, patch)
    dispatch({ type: 'UPDATE_LESSON', lesson: { id, ...patch, ...updated } })
  }, [])

  const removeLesson = useCallback(async (id) => {
    await apiDeleteLesson(id)
    dispatch({ type: 'REMOVE_LESSON', id })
  }, [])

  return (
    <LessonsContext.Provider value={{ state, loadLessons, createLesson, updateLesson, removeLesson }}>
      {children}
    </LessonsContext.Provider>
  )
}

export function useLessons() {
  return useContext(LessonsContext)
}
