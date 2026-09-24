import { api } from './client'

export interface PurchaseParty {
  id: string
  partyName: string
  companyName?: string
  phone?: string
  email?: string
  address?: string
  gstNumber?: string
  partyKind: 'FABRIC' | 'ACCESSORY'
  status: string
  createdAt: string
  updatedAt: string
  orders?: PurchasePartyOrder[]
}

export interface PurchasePartyOrder {
  poId: string
  poNumber: string
  poKind?: string
  itemDetails: string
  orderValue: number
  poDate: string
  status: string
}

export interface CreatePurchasePartyRequest {
  partyName: string
  companyName?: string
  phone?: string
  email?: string
  address?: string
  gstNumber?: string
  partyKind: 'FABRIC' | 'ACCESSORY'
}

export const purchasePartiesApi = {
  list: (kind?: 'FABRIC' | 'ACCESSORY') =>
    api.get<PurchaseParty[]>('/api/v1/purchase-parties', { params: kind ? { kind } : {} }).then(r => r.data),
  getById: (id: string) => api.get<PurchaseParty>(`/api/v1/purchase-parties/${id}`).then(r => r.data),
  create: (data: CreatePurchasePartyRequest) =>
    api.post<PurchaseParty>('/api/v1/purchase-parties', data).then(r => r.data),
  update: (id: string, data: Partial<CreatePurchasePartyRequest>) =>
    api.put<PurchaseParty>(`/api/v1/purchase-parties/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/v1/purchase-parties/${id}`).then(r => r.data),
}
