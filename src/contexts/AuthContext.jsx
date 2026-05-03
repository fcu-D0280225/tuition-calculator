import { createContext, useContext, useMemo } from 'react'

const AuthContext = createContext({
  user: null,
  is_admin: false,
  permissions: [],
  teacher_id: null,
  canViewRates: true,
})

export function AuthProvider({ value, children }) {
  const merged = useMemo(() => {
    const perms = value?.permissions || []
    const isAdmin = !!value?.is_admin
    return {
      user: value?.user || null,
      is_admin: isAdmin,
      permissions: perms,
      teacher_id: value?.teacher_id || null,
      canViewRates: isAdmin || perms.includes('view_rates'),
    }
  }, [value])
  return <AuthContext.Provider value={merged}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
