import { api } from './client'

export interface StitchingUnit {
  id: string
  unitName: string
  unitType?: string
  address?: string
  phone?: string
  status: string
  createdAt: string
}

export interface CreateStitchingUnitRequest {
  unitName: string
  unitType?: string
  address?: string
  phone?: string
}

export const stitchingUnitsApi = {
  list: () => api.get<StitchingUnit[]>('/api/v1/stitching-units').then(r => r.data),
  create: (data: CreateStitchingUnitRequest) =>
    api.post<StitchingUnit>('/api/v1/stitching-units', data).then(r => r.data),
  update: (id: string, data: Partial<CreateStitchingUnitRequest>) =>
    api.put<StitchingUnit>(`/api/v1/stitching-units/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/stitching-units/${id}`).then(r => r.data),
}
