import { useAuth } from '../../context/AuthContext';

const Money = ({ value, amount, className = '', digits = 2 }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const permisos = Array.isArray(user?.permissions) ? user.permissions : [];
  const canView = isSuperAdmin || permisos.includes('view_amounts');

  const rawVal = value !== undefined ? value : amount;
  const num = parseFloat(rawVal) || 0;
  const isNeg = num < 0;
  const absNum = Math.abs(num);
  const formattedAbs = absNum.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const fmt = isNeg ? `-$${formattedAbs}` : `$${formattedAbs}`;

  return (
    <span className={canView ? className : `${className} select-none text-slate-300`}>
      {canView ? fmt : '$***'}
    </span>
  );
};

export const MoneyInput = ({ value, onChange, className = '', readOnly = false, step = '0.01', min = '0', placeholder = '0.00', ...props }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const permisos = Array.isArray(user?.permissions) ? user.permissions : [];
  const canView = isSuperAdmin || permisos.includes('view_amounts');

  if (!canView) {
    return (
      <span className={`${className} select-none text-slate-300 bg-transparent inline-flex items-end justify-end`}>
        $***
      </span>
    );
  }

  return (
    <input
      type="number"
      step={step}
      min={min}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      readOnly={readOnly}
      onWheel={(e) => e.currentTarget.blur()}
      {...props}
    />
  );
};

export default Money;
