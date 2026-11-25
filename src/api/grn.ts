import { api } from './client'
import type { FabricRoll, RollEntry } from './fabricRolls'

export interface GrnSummary {
  id: string
  grnNumber: string
  poNumber: string
  grnKind: string
  purchasePartyId?: string
  purchasePartyName?: string
  receivedDate: string
  status: string
  itemCount: number
  billNo?: string
  billTotal?: number
  /** True for GRNs raised without a PO (small purchases) */
  isSample?: boolean
}

/** Supplier invoice received with a GRN. amount/taxable/total are recomputed server-side. */
export interface GrnBillRequest {
  billNo: string
  billDate: string
  particulars?: string
  qty: number
  price: number
  otherCharges: number
  gst: number
  roundOff: number
}

export interface GrnBill extends GrnBillRequest {
  id: string
  amount: number
  taxable: number
  total: number
}

export interface GrnItem {
  id: string
  /** Fabric code, or accessory code on accessory GRNs */
  fabricCode: string
  fabricName: string
  itemCode: string
  itemName: string
  unitOfMeasure: string
  accessoryType?: string
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
  bill?: GrnBill
  isSample?: boolean
}

export interface CreateGrnItemRequest {
  poItemId?: string
  fabricId?: string
  accessoryId?: string
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
  /** Omit for a sample / small-purchase GRN; then purchasePartyId and grnKind are required */
  poId?: string
  purchasePartyId?: string
  grnKind?: 'FABRIC' | 'ACCESSORY'
  receivedDate: string
  vehicleNumber?: string
  notes?: string
  items: CreateGrnItemRequest[]
  bill?: GrnBillRequest
}

export const grnApi = {
  list: (poId?: string) =>
    api.get<GrnSummary[]>('/api/v1/grn', { params: poId ? { poId } : undefined }).then(r => r.data),
  getById: (id: string) => api.get<GrnDetail>(`/api/v1/grn/${id}`).then(r => r.data),
  create: (data: CreateGrnRequest) => api.post<GrnDetail>('/api/v1/grn', data).then(r => r.data),
  saveBill: (id: string, data: GrnBillRequest) => api.put<GrnDetail>(`/api/v1/grn/${id}/bill`, data).then(r => r.data),
  confirm: (id: string) => api.post<GrnDetail>(`/api/v1/grn/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/grn/${id}`),
}
