import { createContext, useContext, useReducer, useCallback } from 'react'
import { apiListLessons, apiCreateLesson, apiUpdateLesson, apiDeleteLesson } from '../data/api.js'

const LessonsContext = createContext(null)

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
    const created = await apiCreateLesson(lesson)
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
