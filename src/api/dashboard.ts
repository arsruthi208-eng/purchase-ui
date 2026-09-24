import { api } from './client'

export interface DepartmentStatus {
  code: string
  label: string
  status: 'NOT_STARTED' | 'DRAFT' | 'CONFIRMED' | string
  statusLabel: string
  quantity: number
  documentNumber?: string | null
}

export interface ProductionReportLine {
  itemId: string
  styleId: string
  styleName: string
  gender: string
  standard: string
  orderedQuantity: number
  departments: DepartmentStatus[]
}

export interface ProductionReportOrder {
  orderId: string
  orderNumber: string
  schoolName: string
  orderDate: string
  orderStatus: string
  productionStage: string
  productionStageLabel: string
  itemCount: number
  totalQuantity: number
  items: ProductionReportLine[]
}

export interface ProductionReport {
  orders: ProductionReportOrder[]
}

export const dashboardApi = {
  productionReport: () =>
    api.get<ProductionReport>('/api/v1/dashboard/production-report').then(r => r.data),
}
