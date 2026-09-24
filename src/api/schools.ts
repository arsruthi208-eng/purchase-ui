import { api } from './client'

export interface School {
  id: string
  schoolCode: string
  schoolName: string
  address?: string
  contactPerson?: string
  phone?: string
  email?: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateSchoolRequest {
  schoolCode: string
  schoolName: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
}

export const schoolsApi = {
  list: () => api.get<School[]>('/api/v1/schools').then(r => r.data),
  getById: (id: string) => api.get<School>(`/api/v1/schools/${id}`).then(r => r.data),
  create: (data: CreateSchoolRequest) => api.post<School>('/api/v1/schools', data).then(r => r.data),
  update: (id: string, data: Partial<CreateSchoolRequest>) => api.put<School>(`/api/v1/schools/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/schools/${id}`).then(r => r.data),
}
