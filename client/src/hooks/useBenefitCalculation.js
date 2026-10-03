import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRhPayrollRequest } from './useRhPayrollRequest';

const deductionFields = ['descuento_isss', 'descuento_afp', 'descuento_renta'];
const validNumber = value => (typeof value === 'number' || typeof value === 'string') && value !== '' && Number.isFinite(Number(value));

export const useBenefitCalculation = ({ url, companyId, open, employeeId, params, enabled = true, savedCalculation, preserveSaved = false, storedKey }) => {
    const [calculo, setCalculo] = useState(null);
    const [calculando, setCalculando] = useState(false);
    const [calculationError, setCalculationError] = useState('');
    const [calculatedContext, setCalculatedContext] = useState(null);
    const [retry, setRetry] = useState(0);
    const context = JSON.stringify([companyId, open, employeeId, params, enabled, preserveSaved, storedKey]);
    const scope = useRhPayrollRequest(context);
    const requiredFields = [...deductionFields, ...(url.includes('liquidaciones') ? ['total_deducciones_auto'] : ['total_deducciones', 'monto_recibir'])];

    useEffect(() => {
        const request = scope.begin();
        setCalculo(null);
        setCalculatedContext(null);
        setCalculationError('');
        setCalculando(Boolean(open && companyId && employeeId && enabled));
        if (!open || !companyId || !employeeId || !enabled) return () => scope.cancel();

        // Una edición sin cambios monetarios conserva las retenciones ya registradas.
        if (preserveSaved && requiredFields.every(field => validNumber(savedCalculation?.[field]))) {
            setCalculo(savedCalculation);
            setCalculatedContext(context);
            setCalculando(false);
            return () => scope.cancel();
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await axios.get(url, {
                    params, headers: { 'x-company-id': companyId }, signal: request.signal
                });
                if (!request.isCurrent()) return;
                if (!requiredFields.every(field => validNumber(data?.[field]))) {
                    throw new Error('El cálculo de retenciones está incompleto.');
                }
                setCalculo(data);
                setCalculatedContext(context);
            } catch (error) {
                if (request.isCurrent()) setCalculationError(error.response?.data?.message || error.message || 'No se pudieron calcular las retenciones.');
            } finally {
                if (request.isCurrent()) setCalculando(false);
            }
        }, 400);
        return () => { clearTimeout(timer); scope.cancel(); };
    }, [context, retry, scope, url]);

    return {
        calculo, setCalculo, calculando, calculationError,
        calculationReady: calculatedContext === context && !calculando && !!calculo,
        retryCalculation: () => setRetry(value => value + 1)
    };
};
