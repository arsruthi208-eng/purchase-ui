import { api } from './client'

export interface PackingEntry {
  id: string
  packingNumber: string
  schoolName: string
  packingDate: string
  status: string
  items: { id: string; styleName: string; accessoryName: string; gender: string; standard: string; quantity: number }[]
}

export interface CreatePackingRequest {
  schoolId: string
  schoolOrderId?: string
  packingDate: string
  notes?: string
  items: { styleId: string; accessoryId: string; gender: string; standard: string; quantity: number; notes?: string }[]
}

export const packingApi = {
  list: (schoolId?: string) =>
    api.get<PackingEntry[]>('/api/v1/packing', { params: schoolId ? { schoolId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<PackingEntry>(`/api/v1/packing/${id}`).then(r => r.data),
  create: (data: CreatePackingRequest) => api.post<PackingEntry>('/api/v1/packing', data).then(r => r.data),
  confirm: (id: string) => api.post<PackingEntry>(`/api/v1/packing/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/packing/${id}`),
}
