import { createContext, useContext, useReducer, useCallback } from 'react'
import {
  apiListGroups, apiCreateGroup, apiUpdateGroup, apiDeleteGroup,
  apiListGroupRecords, apiCreateGroupRecord, apiUpdateGroupRecord, apiDeleteGroupRecord,
} from '../data/api.js'

const GroupsContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_GROUPS':
      return { ...state, groups: action.groups, loading: false }
    case 'ADD_GROUP':
      return { ...state, groups: [...state.groups, action.group] }
    case 'UPDATE_GROUP':
      return { ...state, groups: state.groups.map(g => g.id === action.group.id ? { ...g, ...action.group } : g) }
    case 'REMOVE_GROUP':
      return { ...state, groups: state.groups.filter(g => g.id !== action.id) }
    case 'SET_RECORDS':
      return { ...state, records: action.records, recordsLoading: false }
    case 'ADD_RECORD':
      return { ...state, records: [action.record, ...state.records] }
    case 'UPDATE_RECORD':
      return { ...state, records: state.records.map(r => r.id === action.record.id ? { ...r, ...action.record } : r) }
    case 'REMOVE_RECORD':
      return { ...state, records: state.records.filter(r => r.id !== action.id) }
    case 'SET_LOADING':
      return { ...state, loading: action.loading }
    case 'SET_RECORDS_LOADING':
      return { ...state, recordsLoading: action.loading }
    default:
      return state
  }
}

export function GroupsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    groups: [], loading: false,
    records: [], recordsLoading: false,
  })

  const loadGroups = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const groups = await apiListGroups()
    dispatch({ type: 'SET_GROUPS', groups })
  }, [])

  const createGroup = useCallback(async (group) => {
    const created = await apiCreateGroup(group)
    dispatch({ type: 'ADD_GROUP', group: created })
    return created
  }, [])

  const updateGroup = useCallback(async (id, patch) => {
    await apiUpdateGroup(id, patch)
    dispatch({ type: 'UPDATE_GROUP', group: { id, ...patch } })
  }, [])

  const removeGroup = useCallback(async (id) => {
    await apiDeleteGroup(id)
    dispatch({ type: 'REMOVE_GROUP', id })
  }, [])

  const loadRecords = useCallback(async (filters = {}) => {
    dispatch({ type: 'SET_RECORDS_LOADING', loading: true })
    const records = await apiListGroupRecords(filters)
    dispatch({ type: 'SET_RECORDS', records })
  }, [])

  const createRecord = useCallback(async (record) => {
    const created = await apiCreateGroupRecord(record)
    dispatch({ type: 'ADD_RECORD', record: created })
    return created
  }, [])

  const updateRecord = useCallback(async (id, patch) => {
    await apiUpdateGroupRecord(id, patch)
    dispatch({ type: 'UPDATE_RECORD', record: { id, ...patch } })
  }, [])

  const removeRecord = useCallback(async (id) => {
    await apiDeleteGroupRecord(id)
    dispatch({ type: 'REMOVE_RECORD', id })
  }, [])

  return (
    <GroupsContext.Provider value={{
      state,
      loadGroups, createGroup, updateGroup, removeGroup,
      loadRecords, createRecord, updateRecord, removeRecord,
    }}>
      {children}
    </GroupsContext.Provider>
  )
}

export function useGroups() {
  return useContext(GroupsContext)
}
