import { api } from './client'

export interface Colour {
  id: string
  colourName: string
  hexCode?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateColourRequest {
  colourName: string
  hexCode?: string
}

export const coloursApi = {
  list: () => api.get<Colour[]>('/api/v1/colours').then(r => r.data),
  create: (data: CreateColourRequest) => api.post<Colour>('/api/v1/colours', data).then(r => r.data),
  update: (id: string, data: Partial<CreateColourRequest>) => api.put<Colour>(`/api/v1/colours/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/colours/${id}`).then(r => r.data),
}
