import { StudentsProvider } from './StudentsContext.jsx'
import { TeachersProvider } from './TeachersContext.jsx'
import { CoursesProvider } from './CoursesContext.jsx'
import { LessonsProvider } from './LessonsContext.jsx'

export function AppProviders({ children }) {
  return (
    <StudentsProvider>
      <TeachersProvider>
        <CoursesProvider>
          <LessonsProvider>
            {children}
          </LessonsProvider>
        </CoursesProvider>
      </TeachersProvider>
    </StudentsProvider>
  )
}
