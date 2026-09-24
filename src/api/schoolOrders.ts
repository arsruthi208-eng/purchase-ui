import { api } from './client'

export type SchoolOrderKind = 'SCHOOL_SIZE' | 'SCHOOL_STD' | 'CORPORATE'

export interface SchoolOrderSummary {
  id: string
  orderNumber: string
  schoolId: string
  schoolName: string
  academicYear?: string
  orderDate: string
  status: string
  orderKind?: SchoolOrderKind
  itemCount: number
  totalQuantity: number
  productionStage: string
}

export interface SchoolOrderItemResponse {
  id: string
  styleId: string
  styleName: string
  gender: string
  standard: string
  quantity: number
  size?: string
  totalStudentCount?: number
  studentCount?: number
  setCount?: number
  sectionTitle?: string
}

export interface SchoolOrderDetail {
  id: string
  orderNumber: string
  schoolId: string
  schoolName: string
  schoolAddress?: string
  academicYear?: string
  orderDate: string
  notes?: string
  status: string
  orderKind: SchoolOrderKind
  subject?: string
  orderListLabel?: string
  items: SchoolOrderItemResponse[]
}

export interface CreateSchoolOrderItemRequest {
  styleId: string
  gender: string
  standard: string
  quantity: number
  size?: string
  totalStudentCount?: number
  studentCount?: number
  setCount?: number
  sectionTitle?: string
}

export interface CreateSchoolOrderRequest {
  schoolId: string
  academicYear?: string
  orderDate: string
  notes?: string
  orderKind: SchoolOrderKind
  subject?: string
  orderListLabel?: string
  items: CreateSchoolOrderItemRequest[]
}

export interface OrderItemProductionStatus {
  itemId: string
  styleId: string
  styleName: string
  gender: string
  standard: string
  quantity: number
  stage: string
  stageLabel: string
  doneStages: string[]
  pendingStages: string[]
}

export const PRODUCTION_STAGES = ['CUTTING', 'CUT', 'SENT_TO_UNIT', 'STITCHED', 'IRONING', 'IRONED', 'PACKED', 'DISPATCHED'] as const
export const STAGE_LABELS: Record<string, string> = {
  PENDING:      'Pending',
  CUTTING:      'Cutting (Draft)',
  CUT:          'Cut',
  SENT_TO_UNIT: 'Sent to Unit',
  STITCHED:     'Kaja / Stitched',
  IRONING:      'Ironing (Draft)',
  IRONED:       'Ironed',
  PACKED:       'Packed',
  DISPATCHED:   'Dispatched',
}

export const ORDER_KIND_LABEL: Record<SchoolOrderKind, string> = {
  SCHOOL_SIZE: 'Size',
  SCHOOL_STD: 'By standard',
  CORPORATE: 'Corporate',
}

export const schoolOrdersApi = {
  list: () => api.get<SchoolOrderSummary[]>('/api/v1/school-orders').then(r => r.data),
  getById: (id: string) => api.get<SchoolOrderDetail>(`/api/v1/school-orders/${id}`).then(r => r.data),
  create: (data: CreateSchoolOrderRequest) => api.post<SchoolOrderDetail>('/api/v1/school-orders', data).then(r => r.data),
  update: (id: string, data: CreateSchoolOrderRequest) =>
    api.put<SchoolOrderDetail>(`/api/v1/school-orders/${id}`, data).then(r => r.data),
  confirm: (id: string) => api.post<SchoolOrderDetail>(`/api/v1/school-orders/${id}/confirm`).then(r => r.data),
  delete: (id: string) => api.delete(`/api/v1/school-orders/${id}`).then(r => r.data),
  getProductionStatus: (id: string) =>
    api.get<OrderItemProductionStatus[]>(`/api/v1/school-orders/${id}/production-status`).then(r => r.data),
}
