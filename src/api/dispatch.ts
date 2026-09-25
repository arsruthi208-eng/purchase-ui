import { api } from './client'

export interface DispatchEntry {
  id: string
  dispatchNumber: string
  schoolName: string
  dispatchDate: string
  vehicleNumber?: string
  driverName?: string
  deliveryAddress?: string
  status: string
  items: { id: string; styleName: string; gender: string; standard: string; quantity: number }[]
}

export interface CreateDispatchRequest {
  schoolId: string
  schoolOrderId?: string
  packingEntryId?: string
  dispatchDate: string
  vehicleNumber?: string
  driverName?: string
  deliveryAddress?: string
  notes?: string
  items: { styleId: string; gender: string; standard: string; quantity: number; notes?: string }[]
}

export const dispatchApi = {
  list: (schoolId?: string) =>
    api.get<DispatchEntry[]>('/api/v1/dispatch', { params: schoolId ? { schoolId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<DispatchEntry>(`/api/v1/dispatch/${id}`).then(r => r.data),
  create: (data: CreateDispatchRequest) => api.post<DispatchEntry>('/api/v1/dispatch', data).then(r => r.data),
  dispatch: (id: string) => api.post<DispatchEntry>(`/api/v1/dispatch/${id}/dispatch`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/dispatch/${id}`),
}
