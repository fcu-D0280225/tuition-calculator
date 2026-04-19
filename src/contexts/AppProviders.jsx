import { StudentsProvider } from './StudentsContext.jsx'
import { TeachersProvider } from './TeachersContext.jsx'
import { CoursesProvider } from './CoursesContext.jsx'
import { LessonsProvider } from './LessonsContext.jsx'
import { MaterialsProvider } from './MaterialsContext.jsx'
import { GroupsProvider } from './GroupsContext.jsx'

export function AppProviders({ children }) {
  return (
    <StudentsProvider>
      <TeachersProvider>
        <CoursesProvider>
          <LessonsProvider>
            <MaterialsProvider>
              <GroupsProvider>
                {children}
              </GroupsProvider>
            </MaterialsProvider>
          </LessonsProvider>
        </CoursesProvider>
      </TeachersProvider>
    </StudentsProvider>
  )
}
