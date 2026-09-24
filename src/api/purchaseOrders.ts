import { api } from './client'

export interface PoSummary {
  id: string
  poNumber: string
  poKind?: string
  purchasePartyName?: string
  schoolOrderNumber?: string
  schoolName?: string
  poDate: string
  status: string
  itemCount: number
}

export interface PoSignature {
  role: string          // PREPARED_BY | CHECKED_BY | AUTHORISED_BY
  signerName: string
  signedAt: string      // ISO timestamp
  signatureImage: string // base64 data-URL
}

export interface PoDetail {
  id: string
  poNumber: string
  poKind?: string
  purchasePartyId?: string
  purchasePartyName?: string
  gstNumber?: string
  purchasePartyPhone?: string
  purchasePartyAddress?: string
  styleName?: string
  schoolName?: string
  schoolOrderId?: string
  schoolOrderNumber?: string
  poDate: string
  expectedDeliveryDate?: string
  deliveryAddress?: string
  shippingAddress?: string
  transportDetails?: string
  notes?: string
  status: string
  items: PoItem[]
  signatures?: PoSignature[]
}

export interface PoItem {
  id: string
  fabricId?: string
  fabricCode?: string
  fabricName?: string
  fabricType?: string
  accessoryId?: string
  accessoryCode?: string
  accessoryName?: string
  accessoryType?: string
  colourId?: string
  colourName?: string
  unitOfMeasure: string
  orderedQuantity: number
  unitPrice: number
  weightGsm?: number
  widthInches?: number
  receivedQuantity: number
  status: string
}

export interface CreatePoRequest {
  purchasePartyId: string
  styleId?: string
  schoolId?: string
  schoolOrderId: string
  poDate: string
  expectedDeliveryDate?: string
  deliveryAddress?: string
  shippingAddress?: string
  transportDetails?: string
  notes?: string
  poKind?: 'FABRIC' | 'ACCESSORY'
  items: {
    fabricId?: string
    accessoryId?: string
    colourId?: string
    unitOfMeasure: string
    orderedQuantity: number
    unitPrice: number
    composition?: string
    weightGsm?: number
    widthInches?: number
  }[]
}

export const purchaseOrdersApi = {
  list: (status?: string, kind: 'FABRIC' | 'ACCESSORY' = 'FABRIC') =>
    api.get<PoSummary[]>('/api/v1/purchase-orders', { params: { ...(status ? { status } : {}), kind } }).then(r => r.data),
  getById: (id: string) => api.get<PoDetail>(`/api/v1/purchase-orders/${id}`).then(r => r.data),
  create: (data: CreatePoRequest) => api.post<PoDetail>('/api/v1/purchase-orders', data).then(r => r.data),
  update: (id: string, data: CreatePoRequest) => api.put<PoDetail>(`/api/v1/purchase-orders/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/purchase-orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.patch<PoSummary>(`/api/v1/purchase-orders/${id}/status`, null, { params: { status } }).then(r => r.data),
  sign: (id: string, role: string) =>
    api.post<PoDetail>(`/api/v1/purchase-orders/${id}/sign/${role}`).then(r => r.data),
}
