import { api } from './client'
import type { FabricRoll } from './fabricRolls'

export interface CuttingItem {
  id: string
  styleId?: string
  styleName: string
  fabricId: string
  fabricName: string
  colourName?: string
  gender: string
  standard: string
  quantity: number
  fabricConsumed: number
  /** Metres per piece from the style's fabricConsumptionRate */
  fabricConsumptionRate?: number
  /** Rolls assigned to this cutting item */
  rolls: FabricRoll[]
}

export interface CuttingOrder {
  id: string
  cuttingNumber: string
  schoolName: string
  schoolOrderId?: string
  schoolOrderNumber?: string
  cuttingDate: string
  status: string
  sentToPersonName?: string
  notes?: string
  items: CuttingItem[]
}

export interface CreateCuttingItemRequest {
  styleId: string
  fabricId: string
  colourId?: string
  gender: string
  standard: string
  quantity: number
  fabricConsumed: number
  notes?: string
  /** IDs of rolls the user selected for this item */
  rollIds?: string[]
}

export interface CreateCuttingRequest {
  schoolId: string
  schoolOrderId?: string
  cuttingDate: string
  notes?: string
  sentToPersonName?: string
  items: CreateCuttingItemRequest[]
}

export interface UpdateCuttingRequest {
  cuttingDate: string
  sentToPersonName?: string
  notes?: string
  items: { id: string; quantity: number; rollIds?: string[] }[]
}

export const cuttingApi = {
  list: (schoolId?: string) =>
    api.get<CuttingOrder[]>('/api/v1/cutting-orders', { params: schoolId ? { schoolId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<CuttingOrder>(`/api/v1/cutting-orders/${id}`).then(r => r.data),
  create: (data: CreateCuttingRequest) => api.post<CuttingOrder>('/api/v1/cutting-orders', data).then(r => r.data),
  update: (id: string, data: UpdateCuttingRequest) => api.patch<CuttingOrder>(`/api/v1/cutting-orders/${id}`, data).then(r => r.data),
  confirm: (id: string) => api.post<CuttingOrder>(`/api/v1/cutting-orders/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/cutting-orders/${id}`),
}
