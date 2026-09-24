import { api } from './client'

export interface Fabric {
  id: string
  fabricCode: string
  fabricName: string
  fabricType: string
  unitOfMeasure: string
  composition: number          // mandatory: meters per unit/student (e.g. 1.2)
  weightGsm?: number
  widthInches?: number
  minStockMeters?: number
  schoolNames?: string[]
  partyNames?: string[]
  schoolIds?: string[]
  partyIds?: string[]
  status: string
}

export const fabricsApi = {
  list: (fabricType?: string, partyId?: string) =>
    api.get<Fabric[]>('/api/v1/fabrics', {
      params: {
        ...(fabricType ? { fabricType } : {}),
        ...(partyId ? { partyId } : {}),
      },
    }).then(r => r.data),
  types: () => api.get<string[]>('/api/v1/fabrics/types').then(r => r.data),
  getById: (id: string) => api.get<Fabric>(`/api/v1/fabrics/${id}`).then(r => r.data),
  create: (data: Omit<Fabric, 'id' | 'status' | 'fabricCode'>) => api.post<Fabric>('/api/v1/fabrics', data).then(r => r.data),
  update: (id: string, data: Partial<Fabric>) => api.put<Fabric>(`/api/v1/fabrics/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/fabrics/${id}`).then(r => r.data),
}
