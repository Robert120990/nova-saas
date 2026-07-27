import React from 'react';
import { 
  ShoppingCart, Ban, FileMinus, FilePlus,
  FileCheck, FileX, RefreshCcw, AlertTriangle, XCircle,
  Banknote, Trash2, ArrowLeftRight,
  Package, Receipt,
  PackageCheck, ArrowUpDown, Calculator,
  Wallet, Handshake,
  UserPlus, CheckCircle, FileText, Umbrella, Gift,
  BookOpen, Lock, Unlock,
  Box, Wrench,
  Bell
} from 'lucide-react';

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
  'employee_created': '#059669', 'payroll_generated': '#2563eb',
  'payroll_closed': '#16a34a', 'settlement_created': '#9333ea',
  'vacation_payroll_generated': '#0d9488', 'bonus_payroll_generated': '#dc2626',
  'accounting_entry_created': '#1d4ed8', 'accounting_entry_voided': '#dc2626',
  'accounting_closing_done': '#9333ea', 'accounting_opening_done': '#16a34a',
  'production_batch_created': '#0891b2', 'production_batch_completed': '#16a34a',
  'maintenance_log_created': '#f59e0b', 'company_created': '#6366f1',
  'branch_created': '#14b8a6', 'user_created': '#059669'
};

const defaultIcon = 'Bell';
const defaultColor = '#6366f1';

const actionIcons = {
  sale_created: 'ShoppingCart', sale_annulled: 'Ban',
  sale_credit_note: 'FileMinus', sale_debit_note: 'FilePlus',
  dte_emitted: 'FileCheck', dte_invalidated: 'FileX',
  dte_retransmitted: 'RefreshCcw', dte_contingency: 'AlertTriangle',
  dte_rejected: 'XCircle',
  cxc_payment_received: 'Banknote', cxc_payment_deleted: 'Trash2',
  cxp_payment_made: 'ArrowRightLeft', cxp_payment_deleted: 'Trash2',
  purchase_created: 'Package', purchase_annulled: 'Ban',
  expense_created: 'Receipt', expense_annulled: 'Ban',
  transfer_created: 'ArrowLeftRight', transfer_received: 'PackageCheck',
  transfer_annulled: 'Ban', adjustment_applied: 'ArrowUpDown',
  physical_inventory_applied: 'Calculator', low_stock: 'AlertTriangle',
  gas_closeout_completed: 'Calculator', gas_advance_given: 'Wallet',
  gas_remesa_delivered: 'Handshake', gas_anticipo_created: 'Banknote',
  employee_created: 'UserPlus', payroll_generated: 'Calculator',
  payroll_closed: 'CheckCircle', settlement_created: 'FileText',
  vacation_payroll_generated: 'Umbrella', bonus_payroll_generated: 'Gift',
  accounting_entry_created: 'BookOpen', accounting_entry_voided: 'Lock',
  accounting_closing_done: 'Lock', accounting_opening_done: 'Unlock',
  production_batch_created: 'Box', production_batch_completed: 'CheckCircle',
  maintenance_log_created: 'Wrench', company_created: 'Building2',
  branch_created: 'GitBranch', user_created: 'UserPlus'
};

function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 86400)} d`;
  return date.toLocaleDateString('es-SV');
}

const NotificationItem = ({ notification, onClick, compact = false }) => {
  const iconName = actionIcons[notification.action_code] || defaultIcon;
  const Icon = iconMap[iconName] || Bell;
  const color = colorMap[notification.action_code] || defaultColor;

  return (
    <button
      onClick={() => onClick?.(notification)}
      className={`w-full text-left transition-all hover:bg-slate-50 ${
        !notification.is_read ? 'bg-indigo-50/50' : ''
      } ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className="rounded-lg p-2 flex-shrink-0 mt-0.5"
          style={{ backgroundColor: color + '15' }}
        >
          <Icon size={compact ? 14 : 16} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`font-bold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
              {notification.title}
            </span>
            <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0 mt-0.5">
              {getTimeAgo(notification.created_at)}
            </span>
          </div>
          {notification.message && (
            <p className={`text-slate-500 mt-0.5 line-clamp-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
              {notification.message}
            </p>
          )}
          {!notification.is_read && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />
          )}
        </div>
      </div>
    </button>
  );
};

export default NotificationItem;
