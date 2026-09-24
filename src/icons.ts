/**
 * Central icon registry.
 *
 * NAV / display icons → Phosphor React (supports weight="fill" for filled look).
 * Action icons (buttons, toolbars) → Lucide React (clean outline in context).
 *
 * To swap either library, edit only this file.
 */

// ── Navigation / domain icons (Phosphor, used with weight="fill") ──────────
export {
  SquaresFour      as LayoutDashboard,
  GraduationCap    as School,
  Users,
  Truck,
  Palette,
  Stack            as Layers,
  Package,
  Factory,
  ShoppingCart,
  ClipboardText    as ClipboardList,
  Scissors,
  PaperPlaneRight  as SendHorizonal,
  Archive,
  SealCheck        as PackageCheck,
  MapPin,
  Printer,
  GearSix as Settings,
  UserCircle as UserRound,
} from '@phosphor-icons/react'

// ClipboardText exported under a second alias for the School Orders nav icon
export { ClipboardText as SchoolOrderIcon } from '@phosphor-icons/react'

// ── Action / button icons (Lucide, outline) ─────────────────────────────────
export {
  Plus,
  Pencil,
  Trash2,
  Search,
  FileText,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
