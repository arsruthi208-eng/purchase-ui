import { api } from './client'
import type { FabricRoll, RollEntry } from './fabricRolls'

export interface GrnSummary {
  id: string
  grnNumber: string
  poNumber: string
  grnKind: string
  receivedDate: string
  status: string
  itemCount: number
}

export interface GrnItem {
  id: string
  fabricCode: string
  fabricName: string
  colourName?: string
  receivedQuantity: number
  toleranceQuantity: number
  unitPrice: number
  notes?: string
  /** Fabric roll records created when GRN is confirmed */
  rolls: FabricRoll[]
}

export interface GrnDetail {
  id: string
  grnNumber: string
  poNumber: string
  grnKind: string
  purchasePartyName?: string
  receivedDate: string
  vehicleNumber?: string
  notes?: string
  status: string
  items: GrnItem[]
}

export interface CreateGrnItemRequest {
  poItemId?: string
  fabricId: string
  colourId?: string
  /** Leave 0 if using rolls[] — total will be derived server-side */
  receivedQuantity: number
  toleranceQuantity?: number
  unitPrice?: number
  notes?: string
  /** One entry per physical roll for this fabric */
  rolls?: RollEntry[]
}

export interface CreateGrnRequest {
  poId: string
  receivedDate: string
  vehicleNumber?: string
  notes?: string
  items: CreateGrnItemRequest[]
}

export const grnApi = {
  list: (poId?: string) =>
    api.get<GrnSummary[]>('/api/v1/grn', { params: poId ? { poId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<GrnDetail>(`/api/v1/grn/${id}`).then(r => r.data),
  create: (data: CreateGrnRequest) => api.post<GrnDetail>('/api/v1/grn', data).then(r => r.data),
  confirm: (id: string) => api.post<GrnDetail>(`/api/v1/grn/${id}/confirm`).then(r => r.data),
}
