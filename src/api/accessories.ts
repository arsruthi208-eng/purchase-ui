import { api } from './client'

export interface AccessoryCategory {
  id: string
  categoryName: string
  status: string
}

export interface AccessoryType {
  id: string
  categoryId: string
  categoryName?: string
  typeName: string
  status: string
}

export interface Accessory {
  id: string
  accessoryCode: string
  accessoryName: string
  typeId: string
  typeName: string
  categoryId: string
  categoryName: string
  unitOfMeasure: string
  partyNames?: string[]
  partyIds?: string[]
  status: string
  createdAt: string
}

export interface CreateAccessoryRequest {
  accessoryName: string
  typeId: string
  unitOfMeasure: string
  partyId?: string
}

export const accessoriesApi = {
  list: (typeId?: string, partyId?: string) =>
    api.get<Accessory[]>('/api/v1/accessories', {
      params: {
        ...(typeId ? { typeId } : {}),
        ...(partyId ? { partyId } : {}),
      },
    }).then(r => r.data),
  create: (data: CreateAccessoryRequest) => api.post<Accessory>('/api/v1/accessories', data).then(r => r.data),
  update: (id: string, data: Partial<CreateAccessoryRequest>) =>
    api.put<Accessory>(`/api/v1/accessories/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/accessories/${id}`).then(r => r.data),
}

export const accessoryCategoriesApi = {
  list: () => api.get<AccessoryCategory[]>('/api/v1/accessory-categories').then(r => r.data),
  create: (data: { categoryName: string }) =>
    api.post<AccessoryCategory>('/api/v1/accessory-categories', data).then(r => r.data),
}

export const accessoryTypesApi = {
  list: (categoryId?: string) =>
    api.get<AccessoryType[]>('/api/v1/accessory-types', { params: categoryId ? { categoryId } : undefined }).then(r => r.data),
  create: (data: { categoryId: string; typeName: string }) =>
    api.post<AccessoryType>('/api/v1/accessory-types', data).then(r => r.data),
}
