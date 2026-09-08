import {
  ShoppingCart, Ban, FileMinus, FilePlus,
  FileCheck, FileX, RefreshCcw, AlertTriangle, XCircle,
  Banknote, Trash2, ArrowLeftRight,
  Package, Receipt,
  PackageCheck, ArrowUpDown, Calculator,
  Wallet, Handshake,
  UserPlus, CheckCircle, FileText, Umbrella, Gift,
  BookOpen, Lock, Unlock,
  Box, Wrench, Bell, X
} from 'lucide-react';
import { toast } from 'sonner';

const iconMap = {
  ShoppingCart, Ban, FileMinus, FilePlus,
  FileCheck, FileX, RefreshCcw, AlertTriangle, XCircle,
  Banknote, Trash2, ArrowLeftRight,
  Package, Receipt,
  PackageCheck, ArrowUpDown, Calculator,
  Wallet, Handshake,
  UserPlus, CheckCircle, FileText, Umbrella, Gift,
  BookOpen, Lock, Unlock,
  Box, Wrench, Bell
};

const colorMap = {
  'sale_created': '#10b981', 'sale_annulled': '#ef4444',
  'sale_credit_note': '#f59e0b', 'sale_debit_note': '#f97316',
  'dte_emitted': '#3b82f6', 'dte_invalidated': '#8b5cf6',
  'dte_retransmitted': '#06b6d4', 'dte_contingency': '#f59e0b',
  'dte_rejected': '#ef4444',
  'cxc_payment_received': '#22c55e', 'cxc_payment_deleted': '#ef4444',
  'cxp_payment_made': '#a855f7', 'cxp_payment_deleted': '#ef4444',
  'purchase_created': '#06b6d4', 'purchase_annulled': '#ef4444',
  'expense_created': '#f97316', 'expense_annulled': '#dc2626',
  'transfer_created': '#14b8a6', 'transfer_received': '#22c55e',
  'transfer_annulled': '#ef4444', 'adjustment_applied': '#6366f1',
  'physical_inventory_applied': '#0ea5e9', 'low_stock': '#f97316',
  'gas_closeout_completed': '#059669', 'gas_advance_given': '#d97706',
  'gas_remesa_delivered': '#7c3aed', 'gas_anticipo_created': '#0891b2',
  'sales_remesa_delivered': '#7c3aed',
  'employee_created': '#059669', 'payroll_generated': '#2563eb',
  'payroll_closed': '#16a34a', 'settlement_created': '#9333ea',
  'vacation_payroll_generated': '#0d9488', 'bonus_payroll_generated': '#dc2626',
  'accounting_entry_created': '#1d4ed8', 'accounting_entry_voided': '#dc2626',
  'accounting_closing_done': '#9333ea', 'accounting_opening_done': '#16a34a',
  'production_batch_created': '#0891b2', 'production_batch_completed': '#16a34a',
  'maintenance_log_created': '#f59e0b', 'company_created': '#6366f1',
  'branch_created': '#14b8a6', 'user_created': '#059669'
};

const actionIcons = {
  sale_created: 'ShoppingCart', sale_annulled: 'Ban',
  sale_credit_note: 'FileMinus', sale_debit_note: 'FilePlus',
  dte_emitted: 'FileCheck', dte_invalidated: 'FileX',
  dte_retransmitted: 'RefreshCcw', dte_contingency: 'AlertTriangle',
  dte_rejected: 'XCircle',
  cxc_payment_received: 'Banknote', cxc_payment_deleted: 'Trash2',
  cxp_payment_made: 'ArrowLeftRight', cxp_payment_deleted: 'Trash2',
  purchase_created: 'Package', purchase_annulled: 'Ban',
  expense_created: 'Receipt', expense_annulled: 'Ban',
  transfer_created: 'ArrowLeftRight', transfer_received: 'PackageCheck',
  transfer_annulled: 'Ban', adjustment_applied: 'ArrowUpDown',
  physical_inventory_applied: 'Calculator', low_stock: 'AlertTriangle',
  gas_closeout_completed: 'Calculator', gas_advance_given: 'Wallet',
  gas_remesa_delivered: 'Handshake', gas_anticipo_created: 'Banknote',
  sales_remesa_delivered: 'Handshake',
  employee_created: 'UserPlus', payroll_generated: 'Calculator',
  payroll_closed: 'CheckCircle', settlement_created: 'FileText',
  vacation_payroll_generated: 'Umbrella', bonus_payroll_generated: 'Gift',
  accounting_entry_created: 'BookOpen', accounting_entry_voided: 'Lock',
  accounting_closing_done: 'Lock', accounting_opening_done: 'Unlock',
  production_batch_created: 'Box', production_batch_completed: 'CheckCircle',
  maintenance_log_created: 'Wrench', company_created: 'Building2',
  branch_created: 'GitBranch', user_created: 'UserPlus'
};

const defaultColor = '#6366f1';

const NotificationToast = ({ notification, toastId, onClick }) => {
  if (!notification) return null;

  const iconName = actionIcons[notification.action_code] || 'Bell';
  const Icon = iconMap[iconName] || Bell;
  const color = colorMap[notification.action_code] || defaultColor;

  return (
    <div
      className="relative flex items-start gap-3 w-full sm:w-[380px] max-w-[calc(100vw-32px)] bg-white rounded-2xl p-3.5 shadow-xl shadow-slate-900/10 border border-slate-200/90 cursor-pointer group hover:border-slate-300 hover:shadow-2xl transition-all duration-200 overflow-hidden"
      onClick={onClick}
    >
      {/* Accent left indicator */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
        style={{ backgroundColor: color }}
      />

      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 duration-200"
        style={{ backgroundColor: color + '18' }}
      >
        <Icon size={18} style={{ color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Notificación
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Ahora
          </span>
        </div>
        <p className="text-[13px] font-bold text-slate-800 leading-snug">
          {notification.title || 'Nueva notificación'}
        </p>
        {notification.message && (
          <p className="text-[12px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
        )}
        {notification.link && (
          <span className="inline-flex items-center text-[11px] font-bold text-indigo-600 group-hover:text-indigo-700 mt-1.5 transition-colors">
            Ver detalle &rarr;
          </span>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toast.dismiss(toastId);
        }}
        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 -mr-1 -mt-1"
        title="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default NotificationToast;
