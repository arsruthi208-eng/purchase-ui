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
  sourceLabel?: string
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

export interface DcConfirmedSummary {
  id: string
  dcNumber: string
  schoolName?: string
}

export interface DcSourceInfo {
  sourceType: string
  label: string
  confirmedDcs: DcConfirmedSummary[]
}

export interface DcItemSummary {
  styleId: string
  styleName: string
  gender: string
  standard: string
  sentQty: number
}

export const stageGrnApi = {
  list: () => api.get<StageGrn[]>('/api/v1/stage-grn').then(r => r.data),
  getById: (id: string) => api.get<StageGrn>(`/api/v1/stage-grn/${id}`).then(r => r.data),
  sources: () => api.get<DcSourceInfo[]>('/api/v1/stage-grn/sources').then(r => r.data),
  sourceItems: (sourceType: string, dcId: string) =>
    api.get<DcItemSummary[]>(`/api/v1/stage-grn/sources/${sourceType}/${dcId}/items`).then(r => r.data),
  create: (data: CreateStageGrnRequest) => api.post<StageGrn>('/api/v1/stage-grn', data).then(r => r.data),
  confirm: (id: string) => api.post<StageGrn>(`/api/v1/stage-grn/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/stage-grn/${id}`),
}
