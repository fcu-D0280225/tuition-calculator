import { createContext, useContext, useReducer, useCallback } from 'react'
import {
  apiListTeachers, apiCreateTeacher, apiRenameTeacher, apiDeleteTeacher,
  apiListTeacherRates, apiSetTeacherRate, apiDeleteTeacherRate,
} from '../data/api.js'

const TeachersContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TEACHERS':
      return { ...state, teachers: action.teachers, loading: false }
    case 'ADD_TEACHER':
      return { ...state, teachers: [...state.teachers, action.teacher] }
    case 'UPDATE_TEACHER':
      return { ...state, teachers: state.teachers.map(t => t.id === action.teacher.id ? { ...t, ...action.teacher } : t) }
    case 'REMOVE_TEACHER':
      return { ...state, teachers: state.teachers.filter(t => t.id !== action.id) }
    case 'SET_RATES':
      return { ...state, rates: { ...state.rates, [action.teacherId]: action.rates } }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

export function TeachersProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { teachers: [], rates: {}, loading: false })

  const loadTeachers = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const teachers = await apiListTeachers()
    dispatch({ type: 'SET_TEACHERS', teachers })
  }, [])

  const createTeacher = useCallback(async (name) => {
    const teacher = await apiCreateTeacher(name)
    dispatch({ type: 'ADD_TEACHER', teacher })
    return teacher
  }, [])

  const renameTeacher = useCallback(async (id, name) => {
    const teacher = await apiRenameTeacher(id, name)
    dispatch({ type: 'UPDATE_TEACHER', teacher })
  }, [])

  const removeTeacher = useCallback(async (id) => {
    await apiDeleteTeacher(id)
    dispatch({ type: 'REMOVE_TEACHER', id })
  }, [])

  const loadRates = useCallback(async (teacherId) => {
    const rates = await apiListTeacherRates(teacherId)
    dispatch({ type: 'SET_RATES', teacherId, rates })
    return rates
  }, [])

  const setRate = useCallback(async (teacherId, courseId, hourlyRate) => {
    await apiSetTeacherRate(teacherId, courseId, hourlyRate)
    const rates = await apiListTeacherRates(teacherId)
    dispatch({ type: 'SET_RATES', teacherId, rates })
  }, [])

  const deleteRate = useCallback(async (teacherId, courseId) => {
    await apiDeleteTeacherRate(teacherId, courseId)
    const rates = await apiListTeacherRates(teacherId)
    dispatch({ type: 'SET_RATES', teacherId, rates })
  }, [])

  return (
    <TeachersContext.Provider value={{ state, loadTeachers, createTeacher, renameTeacher, removeTeacher, loadRates, setRate, deleteRate }}>
      {children}
    </TeachersContext.Provider>
  )
}

export function useTeachers() {
  return useContext(TeachersContext)
}
