import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

export default function EggEmissionRecoveryButton({ saleId, onSuccess }) {
    const [busy, setBusy] = useState(false);
    const recover = async () => {
        setBusy(true);
        try {
            const { data } = await axios.post(`/api/egg-industrial/dispatch/emissions/${saleId}/recover`);
            if (data.success) { toast.success(data.hacienda_msg); onSuccess?.(); }
            else toast.warning(data.hacienda_msg || 'Emisión pendiente de conciliación.');
        } catch (error) { toast.error(error.response?.data?.message || 'No se pudo conciliar la emisión.'); }
        finally { setBusy(false); }
    };
    return <button type="button" disabled={busy} onClick={recover} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 disabled:opacity-50">{busy ? 'Consultando…' : `Conciliar emisión #${saleId}`}</button>;
}
