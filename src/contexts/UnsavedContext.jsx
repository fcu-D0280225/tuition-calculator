import { createContext, useContext, useEffect, useRef } from 'react'

const UnsavedContext = createContext(null)

export function UnsavedProvider({ children }) {
  // 用 ref 而非 state：避免 setDirty 觸發整棵樹重新 render；
  // 每個 key 為一個未儲存的「新增表單」識別字串。
  const dirtyRef = useRef(new Map())

  const setDirty = (key, isDirty) => {
    if (isDirty) dirtyRef.current.set(key, true)
    else dirtyRef.current.delete(key)
  }
  const isAnyDirty = () => dirtyRef.current.size > 0
  const clearAll = () => dirtyRef.current.clear()

  return (
    <UnsavedContext.Provider value={{ setDirty, isAnyDirty, clearAll }}>
      {children}
    </UnsavedContext.Provider>
  )
}

export function useUnsaved() {
  return useContext(UnsavedContext)
}

// 各「新增表單」自己呼叫，傳入唯一 key 與目前是否有任何輸入；
// 卸載時自動清除（避免關閉 modal 後仍卡 dirty）。
export function useDirtyTracker(key, isDirty) {
  const ctx = useContext(UnsavedContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setDirty(key, !!isDirty)
    return () => ctx.setDirty(key, false)
  }, [ctx, key, isDirty])
}
