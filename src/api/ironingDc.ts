import { api } from './client'

export interface IroningDc {
  id: string
  dcNumber: string
  stitchingUnitName: string
  schoolName?: string
  schoolOrderId?: string
  schoolOrderNumber?: string
  deliveryDate: string
  status: string
  sentToPersonName?: string
  items: { id: string; styleId: string; styleName: string; gender: string; standard: string; quantity: number }[]
}

export interface CreateIroningDcRequest {
  stitchingUnitId: string
  schoolOrderId: string
  deliveryDate: string
  notes?: string
  sentToPersonName?: string
  items: { styleId: string; gender: string; standard: string; quantity: number; notes?: string }[]
}

export interface UpdateIroningDcRequest {
  deliveryDate: string
  sentToPersonName?: string
  notes?: string
  items: { id: string; quantity: number }[]
}

export const ironingDcApi = {
  list: (schoolId?: string) =>
    api.get<IroningDc[]>('/api/v1/ironing-dc', { params: schoolId ? { schoolId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<IroningDc>(`/api/v1/ironing-dc/${id}`).then(r => r.data),
  create: (data: CreateIroningDcRequest) => api.post<IroningDc>('/api/v1/ironing-dc', data).then(r => r.data),
  update: (id: string, data: UpdateIroningDcRequest) => api.patch<IroningDc>(`/api/v1/ironing-dc/${id}`, data).then(r => r.data),
  confirm: (id: string) => api.post<IroningDc>(`/api/v1/ironing-dc/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/ironing-dc/${id}`),
}
