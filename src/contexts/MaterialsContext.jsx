import { createContext, useContext, useReducer, useCallback } from 'react'
import {
  apiListMaterials, apiCreateMaterial, apiUpdateMaterial, apiDeleteMaterial,
  apiListMaterialRecords, apiCreateMaterialRecord, apiUpdateMaterialRecord, apiDeleteMaterialRecord,
} from '../data/api.js'

const MaterialsContext = createContext(null)

function reducer(state, action) {
  switch (action.type) {
    case 'SET_MATERIALS':
      return { ...state, materials: action.materials, loading: false }
    case 'ADD_MATERIAL':
      return { ...state, materials: [...state.materials, action.material] }
    case 'UPDATE_MATERIAL':
      return { ...state, materials: state.materials.map(m => m.id === action.material.id ? { ...m, ...action.material } : m) }
    case 'REMOVE_MATERIAL':
      return { ...state, materials: state.materials.filter(m => m.id !== action.id) }
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

export function MaterialsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    materials: [], loading: false,
    records: [], recordsLoading: false,
  })

  const loadMaterials = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    const materials = await apiListMaterials()
    dispatch({ type: 'SET_MATERIALS', materials })
  }, [])

  const createMaterial = useCallback(async (name, unitPrice) => {
    const material = await apiCreateMaterial(name, unitPrice)
    dispatch({ type: 'ADD_MATERIAL', material })
    return material
  }, [])

  const updateMaterial = useCallback(async (id, patch) => {
    await apiUpdateMaterial(id, patch)
    dispatch({ type: 'UPDATE_MATERIAL', material: { id, ...patch } })
  }, [])

  const removeMaterial = useCallback(async (id) => {
    await apiDeleteMaterial(id)
    dispatch({ type: 'REMOVE_MATERIAL', id })
  }, [])

  const loadRecords = useCallback(async (filters = {}) => {
    dispatch({ type: 'SET_RECORDS_LOADING', loading: true })
    const records = await apiListMaterialRecords(filters)
    dispatch({ type: 'SET_RECORDS', records })
  }, [])

  const createRecord = useCallback(async (record) => {
    const created = await apiCreateMaterialRecord(record)
    dispatch({ type: 'ADD_RECORD', record: created })
    return created
  }, [])

  const updateRecord = useCallback(async (id, patch) => {
    await apiUpdateMaterialRecord(id, patch)
    // Reload to get joined names
    dispatch({ type: 'UPDATE_RECORD', record: { id, ...patch } })
  }, [])

  const removeRecord = useCallback(async (id) => {
    await apiDeleteMaterialRecord(id)
    dispatch({ type: 'REMOVE_RECORD', id })
  }, [])

  return (
    <MaterialsContext.Provider value={{
      state,
      loadMaterials, createMaterial, updateMaterial, removeMaterial,
      loadRecords, createRecord, updateRecord, removeRecord,
    }}>
      {children}
    </MaterialsContext.Provider>
  )
}

export function useMaterials() {
  return useContext(MaterialsContext)
}
