import { api } from './client'

export interface CheckingDc {
  id: string
  dcNumber: string
  stitchingUnitName: string
  schoolName?: string
  schoolOrderId?: string
  schoolOrderNumber?: string
  checkDate: string
  status: string
  sentToPersonName?: string
  items: { id: string; styleId: string; styleName: string; gender: string; standard: string; quantity: number }[]
}

export interface CreateCheckingDcRequest {
  stitchingUnitId: string
  schoolOrderId: string
  checkDate: string
  notes?: string
  sentToPersonName?: string
  items: { styleId: string; gender: string; standard: string; quantity: number; notes?: string }[]
}

export interface UpdateCheckingDcRequest {
  checkDate: string
  sentToPersonName?: string
  notes?: string
  items: { id: string; quantity: number }[]
}

export const checkingDcApi = {
  list: (schoolId?: string) =>
    api.get<CheckingDc[]>('/api/v1/checking-dc', { params: schoolId ? { schoolId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<CheckingDc>(`/api/v1/checking-dc/${id}`).then(r => r.data),
  create: (data: CreateCheckingDcRequest) => api.post<CheckingDc>('/api/v1/checking-dc', data).then(r => r.data),
  update: (id: string, data: UpdateCheckingDcRequest) => api.patch<CheckingDc>(`/api/v1/checking-dc/${id}`, data).then(r => r.data),
  confirm: (id: string) => api.post<CheckingDc>(`/api/v1/checking-dc/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/checking-dc/${id}`),
}
