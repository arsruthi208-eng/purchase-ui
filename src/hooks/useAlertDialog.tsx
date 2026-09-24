import { useState } from 'react'
import { AlertDialog, type StockShortfall } from '../components/ui'

interface DialogState {
  open: boolean
  title: string
  message?: string
  variant: 'error' | 'warning' | 'confirm'
  stockShortfalls?: StockShortfall[]
  confirmLabel?: string
  onConfirm?: () => void | Promise<void>
  details?: React.ReactNode
}

const CLOSED: DialogState = { open: false, title: '', variant: 'error' }

/**
 * Drop-in replacement for window.alert() and window.confirm().
 *
 * Usage:
 *   const { dialog, showError, showConfirm, showWarning } = useAlertDialog()
 *   // render {dialog} anywhere in JSX
 *   showError('Title', 'Something went wrong')
 *   showConfirm('Delete', 'Are you sure?', () => doDelete())
 */
export function useAlertDialog() {
  const [state, setState] = useState<DialogState>(CLOSED)

  const showError = (title: string, message?: string, shortfalls?: StockShortfall[]) =>
    setState({ open: true, title, message, variant: 'error', stockShortfalls: shortfalls })

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = 'Confirm',
    details?: React.ReactNode
  ) => setState({ open: true, title, message, variant: 'confirm', onConfirm, confirmLabel, details })

  const showWarning = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = 'Proceed anyway'
  ) => setState({ open: true, title, message, variant: 'warning', onConfirm, confirmLabel })

  const close = () => setState(CLOSED)

  const dialog = state.open ? (
    <AlertDialog
      title={state.title}
      message={state.message}
      details={state.details}
      stockShortfalls={state.stockShortfalls}
      variant={state.variant}
      confirmLabel={state.confirmLabel}
      onClose={close}
      onConfirm={state.onConfirm ? async () => { close(); await state.onConfirm!() } : undefined}
    />
  ) : null

  return { dialog, showError, showConfirm, showWarning }
}
