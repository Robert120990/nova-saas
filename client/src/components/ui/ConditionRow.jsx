import { X } from 'lucide-react';

const operators = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contiene' },
];

const ConditionRow = ({ condition, index, onChange, onRemove, availableVariables }) => {
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase min-w-[20px]">
        {index === 0 ? 'Si' : 'Y'}
      </span>

      <select
        value={condition.field}
        onChange={(e) => onChange(index, { ...condition, field: e.target.value })}
        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        <option value="">Seleccionar campo...</option>
        {availableVariables?.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange(index, { ...condition, operator: e.target.value })}
        className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      <input
        value={condition.value}
        onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
        className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        placeholder="Valor..."
      />

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default ConditionRow;
