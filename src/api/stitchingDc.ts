import { api } from './client'

export interface StitchingDc {
  id: string
  dcNumber: string
  stitchingUnitName: string
  cuttingOrderId?: string
  cuttingOrderNumber?: string
  schoolName?: string
  schoolOrderId?: string
  schoolOrderNumber?: string
  deliveryDate: string
  status: string
  sentToPersonName?: string
  items: { id: string; styleId: string; styleName: string; gender: string; standard: string; quantity: number }[]
  kajaConsumption: { id: string; accessoryName: string; quantity: number; unitOfMeasure: string }[]
}

export interface CreateStitchingDcRequest {
  stitchingUnitId: string
  cuttingOrderId?: string
  schoolId?: string
  schoolOrderId?: string
  deliveryDate: string
  notes?: string
  sentToPersonName?: string
  items?: { styleId: string; gender: string; standard: string; quantity: number; notes?: string }[]
  kajaConsumption: { accessoryId: string; quantity: number; unitOfMeasure?: string; notes?: string }[]
}

export interface UpdateStitchingDcRequest {
  deliveryDate: string
  sentToPersonName?: string
  notes?: string
  items: { id: string; quantity: number }[]
}

export const stitchingDcApi = {
  list: (schoolId?: string) =>
    api.get<StitchingDc[]>('/api/v1/stitching-dc', { params: schoolId ? { schoolId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<StitchingDc>(`/api/v1/stitching-dc/${id}`).then(r => r.data),
  create: (data: CreateStitchingDcRequest) => api.post<StitchingDc>('/api/v1/stitching-dc', data).then(r => r.data),
  update: (id: string, data: UpdateStitchingDcRequest) => api.patch<StitchingDc>(`/api/v1/stitching-dc/${id}`, data).then(r => r.data),
  confirm: (id: string) => api.post<StitchingDc>(`/api/v1/stitching-dc/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/stitching-dc/${id}`),
}
