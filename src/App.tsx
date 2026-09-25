import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Schools from './pages/Schools'
import PurchaseParties from './pages/PurchaseParties'
import PurchasePartyDetail from './pages/PurchasePartyDetail'
import Colours from './pages/Colours'
import Styles from './pages/Styles'
import Fabrics from './pages/Fabrics'
import Accessories from './pages/Accessories'
import StitchingUnits from './pages/StitchingUnits'
import Stock from './pages/Stock'
import PurchaseOrders from './pages/PurchaseOrders'
import PurchaseOrderDetail from './pages/PurchaseOrderDetail'
import Grn from './pages/Grn'
import GrnDetail from './pages/GrnDetail'
import Cutting from './pages/Cutting'
import CuttingDetail from './pages/CuttingDetail'
import UnitDc from './pages/UnitDc'
import UnitDcDetail from './pages/UnitDcDetail'
import AccessoryDc from './pages/AccessoryDc'
import AccessoryDcDetail from './pages/AccessoryDcDetail'
import StitchingDc from './pages/StitchingDc'
import StitchingDcDetail from './pages/StitchingDcDetail'
import IroningDc from './pages/IroningDc'
import IroningDcDetail from './pages/IroningDcDetail'
import CheckingDc from './pages/CheckingDc'
import CheckingDcDetail from './pages/CheckingDcDetail'
import Packing from './pages/Packing'
import PackingDetail from './pages/PackingDetail'
import Dispatch from './pages/Dispatch'
import DispatchDetail from './pages/DispatchDetail'
import SchoolOrders from './pages/SchoolOrders'
import SchoolOrderDetail from './pages/SchoolOrderDetail'
import StageGrnPage from './pages/StageGrn'
import StageGrnDetail from './pages/StageGrnDetail'
import Users from './pages/Users'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public routes (no Layout, no auth) ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ── Protected routes (auth required → Layout → pages) ── */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="schools" element={<Schools />} />
              <Route path="purchase-parties" element={<PurchaseParties />} />
              <Route path="purchase-parties/:id" element={<PurchasePartyDetail />} />
              <Route path="buyers" element={<Navigate to="/purchase-parties" replace />} />
              <Route path="agents" element={<Navigate to="/purchase-parties" replace />} />
              <Route path="suppliers" element={<Navigate to="/purchase-parties" replace />} />
              <Route path="colours" element={<Colours />} />
              <Route path="styles" element={<Styles />} />
              <Route path="fabrics" element={<Fabrics />} />
              <Route path="accessories" element={<Accessories />} />
              <Route path="stitching-units" element={<StitchingUnits />} />
              <Route path="stock" element={<Stock />} />
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="purchase-orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="accessory-purchase-orders" element={<PurchaseOrders kind="ACCESSORY" />} />
              <Route path="accessory-purchase-orders/:id" element={<PurchaseOrderDetail />} />
              <Route path="grn" element={<Grn />} />
              <Route path="grn/:id" element={<GrnDetail />} />
              <Route path="cutting" element={<Cutting />} />
              <Route path="cutting/:id" element={<CuttingDetail />} />
              <Route path="unit-dc" element={<UnitDc />} />
              <Route path="unit-dc/:id" element={<UnitDcDetail />} />
              <Route path="accessory-dc" element={<AccessoryDc />} />
              <Route path="accessory-dc/:id" element={<AccessoryDcDetail />} />
              <Route path="stitching-dc" element={<StitchingDc />} />
              <Route path="stitching-dc/:id" element={<StitchingDcDetail />} />
              <Route path="ironing-dc" element={<IroningDc />} />
              <Route path="ironing-dc/:id" element={<IroningDcDetail />} />
              <Route path="checking-dc" element={<CheckingDc />} />
              <Route path="checking-dc/:id" element={<CheckingDcDetail />} />
              <Route path="packing" element={<Packing />} />
              <Route path="packing/:id" element={<PackingDetail />} />
              <Route path="dispatch" element={<Dispatch />} />
              <Route path="dispatch/:id" element={<DispatchDetail />} />
              <Route path="school-orders" element={<SchoolOrders />} />
              <Route path="school-orders/:id" element={<SchoolOrderDetail />} />
              <Route path="stage-grn" element={<StageGrnPage />} />
              <Route path="stage-grn/:id" element={<StageGrnDetail />} />
              <Route path="users" element={<Users />} />
            </Route>
          </Route>

          {/* Catch-all → login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
