import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { getTodayString } from '../../utils/dateUtils';
import { unwrapList } from '../../utils/apiUtils';

export default function useFiscalOperation(operation) {
    const opening = operation === 'opening';
    const { user } = useAuth();
    const companyId = user?.company_id;
    const confirm = useConfirm();
    const queryClient = useQueryClient();
    const [year, setYear] = useState(new Date().getFullYear() + (opening ? 1 : 0));
    const [date, setDate] = useState(() => getTodayString(new Date(year, opening ? 0 : 11, opening ? 1 : 31)));
    const [description, setDescription] = useState(opening ? 'Apertura del Ejercicio Contable' : 'Cierre del Ejercicio Contable');
    const alive = useRef(true);
    const context = useRef();
    context.current = `${companyId}:${date}`;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const { data, isLoading, isFetching, isError } = useQuery({
        queryKey: ['trial-balance', companyId, operation, date],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/trial-balance', {
            params: { operation, date }, headers: { 'x-company-id': companyId }, signal
        })),
        enabled: !!companyId && !!date, staleTime: 0, refetchOnWindowFocus: true
    });
    const accounts = unwrapList(data);
    const mutation = useMutation({
        mutationFn: ({ headers, ...payload }) => axios.post(`/api/accounting/${operation}`, payload, { headers }),
        onSuccess: async ({ data: result }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['entries'] }),
                queryClient.invalidateQueries({ queryKey: ['trial-balance', companyId] }),
                queryClient.invalidateQueries({ queryKey: ['accounting-correlativos'] })
            ]);
            toast.success(`${opening ? 'Apertura' : 'Cierre'} generado: partida #${result.entry_id}`);
        },
        onError: error => {
            if (error?.response?.status === 404) {
                toast.error('El catálogo de cuentas o período fiscal no fue encontrado en el servidor');
            } else {
                toast.error(error.response?.data?.message || 'No se pudo guardar la partida fiscal');
            }
        }
    });
    const changeYear = value => {
        setYear(value);
        const number = Number(value);
        setDate(Number.isInteger(number) && number >= 2000 && number <= 2200
            ? getTodayString(new Date(number, opening ? 0 : 11, opening ? 1 : 31)) : '');
    };
    const changeDate = value => {
        setDate(value);
        if (value) setYear(new Date(`${value}T00:00:00`).getFullYear());
    };
    const generate = async () => {
        if (mutation.isPending || isFetching || isError || !accounts.length || !date) return;
        const requestContext = context.current;
        const payload = { date, description, headers: {
            Authorization: axios.defaults.headers.common.Authorization, 'x-company-id': String(companyId)
        } };
        const accepted = await confirm({ title: opening ? 'Apertura de Ejercicio' : 'Cierre Anual',
            message: `¿Generar la partida de ${opening ? 'apertura' : 'cierre'} de ${year}?`,
            confirmLabel: opening ? 'Abrir Ejercicio' : 'Cerrar Ejercicio' });
        if (accepted && alive.current && requestContext === context.current) mutation.mutate(payload);
    };
    return { operation, opening, year, date, description, setDescription, changeYear, changeDate,
        accounts, isLoading, isError, busy: isFetching || mutation.isPending, saving: mutation.isPending, generate };
}
