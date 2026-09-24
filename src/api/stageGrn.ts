import { api } from './client'

export interface StageGrnItem {
  id: string
  styleName: string
  gender: string
  standard: string
  sentQty: number
  receivedQty: number
  rejectedQty: number
}

export interface StageGrn {
  id: string
  grnNumber: string
  sourceType: string
  sourceId: string
  sourceDcNumber?: string
  schoolName?: string
  schoolOrderNumber?: string
  receivedDate: string
  notes?: string
  status: string
  items: StageGrnItem[]
}

export interface CreateStageGrnRequest {
  sourceType: string
  sourceId: string
  schoolId?: string
  schoolOrderId?: string
  receivedDate: string
  notes?: string
  items: {
    styleId: string
    gender: string
    standard: string
    sentQty: number
    receivedQty: number
    rejectedQty?: number
    notes?: string
  }[]
}

export const stageGrnApi = {
  list: () => api.get<StageGrn[]>('/api/v1/stage-grn').then(r => r.data),
  getById: (id: string) => api.get<StageGrn>(`/api/v1/stage-grn/${id}`).then(r => r.data),
  create: (data: CreateStageGrnRequest) => api.post<StageGrn>('/api/v1/stage-grn', data).then(r => r.data),
  confirm: (id: string) => api.post<StageGrn>(`/api/v1/stage-grn/${id}/confirm`).then(r => r.data),
}
