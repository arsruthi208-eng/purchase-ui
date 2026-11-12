import { api } from './client'

export interface OutstandingBill {
  billId: string
  billNo: string
  billDate: string
  grnId: string
  grnNumber: string
  poNumber: string
  totalAmount: number
  amountPaid: number
  outstanding: number
}

export interface PartyOutstanding {
  purchasePartyId: string
  purchasePartyName: string
  totalAmount: number
  amountPaid: number
  outstanding: number
  /** Payments received beyond all bills; auto-applied to the next bill */
  advance: number
  bills: OutstandingBill[]
}

export interface PartyPayment {
  id: string
  purchasePartyId: string
  purchasePartyName: string
  paymentDate: string
  amount: number
  mode?: string
  reference?: string
  notes?: string
  allocations: { billNo: string; amount: number }[]
}

export interface RecordPaymentRequest {
  purchasePartyId: string
  paymentDate: string
  amount: number
  mode?: string
  reference?: string
  notes?: string
}

export const outstandingsApi = {
  summary: () => api.get<PartyOutstanding[]>('/api/v1/purchase-outstandings').then(r => r.data),
  payments: (partyId?: string) =>
    api.get<PartyPayment[]>('/api/v1/purchase-outstandings/payments', { params: partyId ? { partyId } : undefined }).then(r => r.data),
  recordPayment: (data: RecordPaymentRequest) =>
    api.post<PartyPayment>('/api/v1/purchase-outstandings/payments', data).then(r => r.data),
  deletePayment: (id: string) => api.delete(`/api/v1/purchase-outstandings/payments/${id}`),
}
