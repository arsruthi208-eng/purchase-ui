import { api } from './client'
import type { FabricRoll, RollEntry } from './fabricRolls'

export type { RollEntry }

export interface StockEntry {
  id: string
  itemType: string
  referenceId: string
  referenceName: string
  rollNumber?: number
  /** For FABRIC entries, individual roll details */
  rolls: FabricRoll[]
  quantity: number
  unitPrice: number
  totalValue: number
  stockDate: string
  notes?: string
  status: string
}

export interface StockBalance {
  itemType: string
  referenceId: string
  referenceName: string
  balance: number
}

export interface StockBalanceSummary {
  itemType: string
  referenceId: string
  referenceName: string
  totalIn: number
  totalOut: number
  balance: number
  rollCount: number
  minStockMeters?: number
}

export interface CreateStockEntryRequest {
  itemType: string
  referenceId: string
  /** For accessories: the total quantity. For fabric: leave 0 (derived from rolls). */
  quantity: number
  /** For accessories: the unit price. For fabric: 0 (price is per-roll). */
  unitPrice: number
  stockDate: string
  notes?: string
  /** Populated only for FABRIC entries — one entry per physical roll */
  rolls?: RollEntry[]
}

export const stockApi = {
  list: (itemType: string) =>
    api.get<StockEntry[]>('/api/v1/stock/entries', { params: { itemType } }).then(r => r.data),
  getById: (id: string) => api.get<StockEntry>(`/api/v1/stock/entries/${id}`).then(r => r.data),
  create: (data: CreateStockEntryRequest) =>
    api.post<StockEntry>('/api/v1/stock/entries', data).then(r => r.data),
  listBalances: (itemType: string) =>
    api.get<StockBalanceSummary[]>('/api/v1/stock/balances', { params: { itemType } }).then(r => r.data),
  balance: (itemType: string, referenceId: string) =>
    api.get<StockBalance>('/api/v1/stock/balance', { params: { itemType, referenceId } }).then(r => r.data),
}
