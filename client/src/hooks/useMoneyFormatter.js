import { useAuth } from '../context/AuthContext';

// Para texto plano (option, tooltip); los elementos visuales usan <Money>.
export default function useMoneyFormatter() {
    const { user } = useAuth();
    const canView = user?.role === 'SuperAdmin' || (Array.isArray(user?.permissions) && user.permissions.includes('view_amounts'));
    return (value, digits = 2) => canView
        ? Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })
        : '$***';
}
