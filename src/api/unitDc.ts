import { api } from './client'

export interface UnitDc {
  id: string
  dcNumber: string
  cuttingNumber: string
  stitchingUnitName: string
  deliveryDate: string
  status: string
  sentToPersonName?: string
  items: { id: string; styleId: string; styleName: string; gender: string; standard: string; quantity: number }[]
}

export interface AccessoryDc {
  id: string
  dcNumber: string
  stitchingUnitName: string
  schoolOrderId?: string
  schoolOrderNumber?: string
  deliveryDate: string
  status: string
  sentToPersonName?: string
  items: { id: string; accessoryName: string; quantity: number; unitOfMeasure: string }[]
}

export interface CreateUnitDcRequest {
  cuttingOrderId: string
  stitchingUnitId: string
  deliveryDate: string
  notes?: string
  sentToPersonName?: string
  items: { styleId: string; gender: string; standard: string; quantity: number; notes?: string }[]
}

export interface CreateAccessoryDcRequest {
  stitchingUnitId: string
  schoolOrderId?: string
  deliveryDate: string
  notes?: string
  sentToPersonName?: string
  items: { accessoryId: string; quantity: number; unitOfMeasure?: string; notes?: string }[]
}

export const unitDcApi = {
  list: () => api.get<UnitDc[]>('/api/v1/unit-dc').then(r => r.data),
  getById: (id: string) => api.get<UnitDc>(`/api/v1/unit-dc/${id}`).then(r => r.data),
  create: (data: CreateUnitDcRequest) => api.post<UnitDc>('/api/v1/unit-dc', data).then(r => r.data),
  confirm: (id: string) => api.post<UnitDc>(`/api/v1/unit-dc/${id}/confirm`).then(r => r.data),
}

export const accessoryDcApi = {
  list: () => api.get<AccessoryDc[]>('/api/v1/accessory-dc').then(r => r.data),
  getById: (id: string) => api.get<AccessoryDc>(`/api/v1/accessory-dc/${id}`).then(r => r.data),
  create: (data: CreateAccessoryDcRequest) => api.post<AccessoryDc>('/api/v1/accessory-dc', data).then(r => r.data),
  confirm: (id: string) => api.post<AccessoryDc>(`/api/v1/accessory-dc/${id}/confirm`).then(r => r.data),
}
