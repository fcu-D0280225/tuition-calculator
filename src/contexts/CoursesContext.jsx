import { createContext, useContext, useReducer, useCallback } from 'react'
import { apiListCourses, apiCreateCourse, apiRenameCourse, apiDeleteCourse } from '../data/api.js'

const CoursesContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_COURSES':
      return { ...state, courses: action.courses, loading: false }
    case 'ADD_COURSE':
      return { ...state, courses: [...state.courses, action.course] }
    case 'UPDATE_COURSE':
      return { ...state, courses: state.courses.map(c => c.id === action.course.id ? { ...c, ...action.course } : c) }
    case 'REMOVE_COURSE':
      return { ...state, courses: state.courses.filter(c => c.id !== action.id) }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    default:
      return state
  }
}

export function CoursesProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { courses: [], loading: false })

  const loadCourses = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const courses = await apiListCourses()
    dispatch({ type: 'SET_COURSES', courses })
  }, [])

  const createCourse = useCallback(async (name) => {
    const course = await apiCreateCourse(name)
    dispatch({ type: 'ADD_COURSE', course })
    return course
  }, [])

  const renameCourse = useCallback(async (id, name) => {
    const course = await apiRenameCourse(id, name)
    dispatch({ type: 'UPDATE_COURSE', course })
  }, [])

  const removeCourse = useCallback(async (id) => {
    await apiDeleteCourse(id)
    dispatch({ type: 'REMOVE_COURSE', id })
  }, [])

  return (
    <CoursesContext.Provider value={{ state, loadCourses, createCourse, renameCourse, removeCourse }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  return useContext(CoursesContext)
}
