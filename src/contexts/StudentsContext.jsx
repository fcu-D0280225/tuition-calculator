import { createContext, useContext, useReducer, useCallback } from 'react'
import { apiListStudents, apiCreateStudent, apiUpdateStudent, apiDeleteStudent } from '../data/api.js'

const StudentsContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STUDENTS':
      return { ...state, students: action.students, loading: false }
    case 'ADD_STUDENT':
      return { ...state, students: [...state.students, action.student] }
    case 'UPDATE_STUDENT':
      return { ...state, students: state.students.map(s => s.id === action.student.id ? { ...s, ...action.student } : s) }
    case 'REMOVE_STUDENT':
      return { ...state, students: state.students.filter(s => s.id !== action.id) }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

export function StudentsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { students: [], loading: false })

  const loadStudents = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const students = await apiListStudents()
    dispatch({ type: 'SET_STUDENTS', students })
  }, [])

  const createStudent = useCallback(async (body) => {
    const student = await apiCreateStudent(body)
    dispatch({ type: 'ADD_STUDENT', student })
    return student
  }, [])

  const updateStudent = useCallback(async (id, patch) => {
    const student = await apiUpdateStudent(id, patch)
    dispatch({ type: 'UPDATE_STUDENT', student })
  }, [])

  const removeStudent = useCallback(async (id) => {
    await apiDeleteStudent(id)
    dispatch({ type: 'REMOVE_STUDENT', id })
  }, [])

  return (
    <StudentsContext.Provider value={{ state, loadStudents, createStudent, updateStudent, removeStudent }}>
      {children}
    </StudentsContext.Provider>
  )
}

export function useStudents() {
  return useContext(StudentsContext)
}
