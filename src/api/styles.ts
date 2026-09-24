import { api } from './client'

export interface Style {
  id: string
  styleCode: string
  styleName: string
  pattern: string
  fabricConsumptionRate?: number
  status: string
  schoolIds: string[]
  schoolNames: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateStyleRequest {
  styleCode: string
  styleName: string
  pattern: string
  fabricConsumptionRate?: number
  schoolIds?: string[]
}

export interface UpdateStyleRequest {
  styleName: string
  pattern: string
  fabricConsumptionRate?: number
  schoolIds?: string[]
}

export const stylesApi = {
  list: (pattern?: string) =>
    api.get<Style[]>('/api/v1/styles', { params: pattern ? { pattern } : undefined }).then(r => r.data),
  patterns: () => api.get<string[]>('/api/v1/styles/patterns').then(r => r.data),
  create: (data: CreateStyleRequest) => api.post<Style>('/api/v1/styles', data).then(r => r.data),
  update: (id: string, data: UpdateStyleRequest) =>
    api.put<Style>(`/api/v1/styles/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/styles/${id}`).then(r => r.data),
}
