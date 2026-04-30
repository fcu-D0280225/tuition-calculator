import { createContext, useContext, useReducer, useCallback } from 'react'
import { apiListCourses, apiCreateCourse, apiUpdateCourse, apiDeleteCourse } from '../data/api.js'

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

  const createCourse = useCallback(async (name, hourlyRate = 0, teacherHourlyRate = 0, discountMultiplier = 1) => {
    const course = await apiCreateCourse(name, hourlyRate, teacherHourlyRate, discountMultiplier)
    dispatch({ type: 'ADD_COURSE', course })
    return course
  }, [])

  const updateCourse = useCallback(async (id, patch) => {
    const course = await apiUpdateCourse(id, patch)
    dispatch({ type: 'UPDATE_COURSE', course: { id, ...patch } })
  }, [])

  const removeCourse = useCallback(async (id) => {
    await apiDeleteCourse(id)
    dispatch({ type: 'REMOVE_COURSE', id })
  }, [])

  return (
    <CoursesContext.Provider value={{ state, loadCourses, createCourse, updateCourse, removeCourse }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  return useContext(CoursesContext)
}
