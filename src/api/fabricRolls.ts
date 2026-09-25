import { api } from './client'

export interface FabricRoll {
  id: string
  rollNumber: number
  quantityMeters: number
  unitPrice: number
  status: 'AVAILABLE' | 'IN_USE' | 'CONSUMED'
}

/** Row entry the user fills while creating an opening stock or GRN entry */
export interface RollEntry {
  quantityMeters: number
  unitPrice: number
}

export const fabricRollsApi = {
  /** All AVAILABLE rolls for a fabric (used in Cutting DC roll selector) */
  available: (fabricId: string): Promise<FabricRoll[]> =>
    api.get<FabricRoll[]>('/api/v1/fabric-rolls/available', { params: { fabricId } }).then(r => r.data),

  /** All non-consumed rolls (AVAILABLE + IN_USE) — used in picker to show reserved rolls too */
  allActive: (fabricId: string): Promise<FabricRoll[]> =>
    api.get<FabricRoll[]>('/api/v1/fabric-rolls/all', { params: { fabricId } }).then(r => r.data),

  /** Next roll number for a fabric (preview only – actual assignment happens on save) */
  nextRollNumber: (fabricId: string): Promise<number> =>
    api.get<{ nextRollNumber: number }>('/api/v1/fabric-rolls/next-roll-number', { params: { fabricId } })
       .then(r => r.data.nextRollNumber),
}
