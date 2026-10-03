import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useDirtyTracker } from '../../hooks/useDirtyTracker';
import { unwrapList } from '../../utils/apiUtils';

export default function useAccountingCorrelativos() {
    const { user } = useAuth();
    const companyId = user?.company_id;
    const headers = { 'x-company-id': companyId };
    const queryClient = useQueryClient();
    const confirm = useConfirm();
    const currentYear = new Date().getFullYear();
    const [typeId, setTypeId] = useState('');
    const [year, setYear] = useState(currentYear);
    const [drafts, setDrafts] = useState({});
    const [conflict, setConflict] = useState(null);
    const [renumberResult, setRenumberResult] = useState(null);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const { data: entryTypes = [] } = useQuery({
        queryKey: ['entryTypes', companyId],
        queryFn: async ({ signal }) => unwrapList(await axios.get('/api/accounting/entry-types', { headers, signal })),
        enabled: !!companyId
    });
    const effectiveTypeId = typeId || String(entryTypes[0]?.id ?? '');
    const key = `${companyId}:${effectiveTypeId}:${year}`;
    const context = useRef(key);
    context.current = key;
    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['accounting-correlativos', companyId, year],
        queryFn: async ({ signal }) => (await axios.get('/api/accounting/correlativos', { params: { year }, headers, signal })).data,
        enabled: !!companyId && Number.isInteger(Number(year)) && year >= 2000 && year <= 2200,
        staleTime: 0, refetchOnWindowFocus: true
    });
    const typeData = useMemo(() => unwrapList(data?.types).find(type => String(type.type_id) === effectiveTypeId), [data, effectiveTypeId]);
    const months = unwrapList(typeData?.months);
    const draft = drafts[key] || {};
    const edits = Object.fromEntries(Object.entries(draft).map(([month, item]) => [month, item.value]));
    const dirtyMonths = Object.entries(draft).map(([month, item]) => ({ month: Number(month), current_number: Number(item.value), expected_current_number: item.expected }));
    const totalPosted = months.reduce((sum, month) => sum + Number(month.posted_entries ?? month.total_entries ?? 0), 0);
    const gapMonths = months.filter(month => month.has_gap);
    const snapshot = () => ({ key, type_id: Number(effectiveTypeId), year: Number(year), headers: {
        Authorization: axios.defaults.headers.common.Authorization, 'x-company-id': String(companyId)
    } });
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['accounting-correlativos', companyId] });
    const saveMutation = useMutation({
        mutationFn: ({ key: _key, headers: requestHeaders, ...payload }) => axios.post('/api/accounting/correlativos', payload, { headers: requestHeaders }),
        onSuccess: async (_result, sent) => {
            setDrafts(previous => {
                const updated = { ...(previous[sent.key] || {}) };
                for (const month of sent.months) {
                    if (Number(updated[month.month]?.value) === month.current_number && updated[month.month]?.expected === month.expected_current_number) delete updated[month.month];
                }
                return { ...previous, [sent.key]: updated };
            });
            await refresh();
            toast.success('Correlativos guardados');
        },
        onError: (error, sent) => {
            if (alive.current && context.current === sent.key && error.response?.status === 409) {
                setConflict({ key: sent.key, months: unwrapList(error.response.data.conflicts) });
                refresh();
            }
            toast.error(error.response?.data?.message || 'Error al guardar. Sus cambios se conservan.');
        }
    });
    const renumberMutation = useMutation({
        mutationFn: ({ key: _key, headers: requestHeaders, ...payload }) => axios.post('/api/accounting/correlativos/renumber', payload, { headers: requestHeaders }),
        onSuccess: async ({ data: result }, sent) => {
            if (alive.current && context.current === sent.key) setRenumberResult(result);
            await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['entries'] })]);
            toast.success(result.message);
        },
        onError: error => toast.error(error.response?.data?.message || 'Error al reenumerar')
    });
    const busy = isFetching || saveMutation.isPending || renumberMutation.isPending;
    useDirtyTracker('accounting-correlativos', Object.keys(drafts).some(item => Object.keys(drafts[item]).length > 0) || saveMutation.isPending);
    const updateMonth = (month, value) => {
        if (busy) return;
        setDrafts(previous => ({ ...previous, [key]: { ...previous[key], [month.month]: {
            value, expected: previous[key]?.[month.month]?.expected !== undefined ? previous[key][month.month].expected : month.next_number ?? null
        } } }));
    };
    const changeFilter = (field, value) => {
        if (busy) return;
        setConflict(null); setRenumberResult(null);
        if (field === 'type') setTypeId(value); else setYear(Number(value) || currentYear);
    };
    const resolveConflict = keep => {
        if (!conflict || conflict.key !== key || busy) return;
        setDrafts(previous => {
            if (!keep) return { ...previous, [key]: {} };
            const updated = { ...previous[key] };
            for (const item of conflict.months) if (updated[item.month]) updated[item.month] = { ...updated[item.month], expected: item.current };
            return { ...previous, [key]: updated };
        });
        setConflict(null); refresh();
    };
    const save = () => {
        if (busy || !effectiveTypeId || !dirtyMonths.length || conflict?.key === key) return;
        saveMutation.mutate({ ...snapshot(), months: dirtyMonths });
    };
    const handleRenumber = async () => {
        if (busy || !totalPosted) return;
        if (dirtyMonths.length) return toast.error('Guarde los cambios de correlativos antes de reenumerar.');
        const sent = snapshot();
        const ok = await confirm({ title: '¿Reenumerar partidas?',
            message: `Se reasignarán los números de ${totalPosted} partidas de ${typeData?.name || ''} del año ${year}, en orden cronológico, reservando los números de las partidas anuladas.`,
            confirmLabel: 'Sí, reenumerar', variant: 'danger' });
        if (ok && alive.current && context.current === sent.key) renumberMutation.mutate(sent);
    };
    return { currentYear, effectiveTypeId, year, edits, conflict, resolveConflict, renumberResult, entryTypes, typeData, months,
        isLoading, busy, saveMutation, save, renumberMutation, dirtyMonths, totalPosted, gapMonths, handleRenumber, updateMonth, changeFilter };
}
