import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { X, QrCode, Copy, Check, ExternalLink, Sparkles, MapPin, User, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function TelegramInviteModal({ open, onClose, branches = [] }) {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('48');
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  const createMutation = useMutation({
    mutationFn: (payload) => axios.post('/api/notifications/telegram/invite-tokens', payload),
    onSuccess: (res) => {
      setGeneratedInvite(res.data);
      queryClient.invalidateQueries(['telegram-status']);
      queryClient.invalidateQueries(['telegram-invite-tokens']);
      toast.success('Enlace y código QR generados con éxito');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al generar invitación')
  });

  if (!open) return null;

  const handleGenerate = (e) => {
    e.preventDefault();
    createMutation.mutate({
      branch_id: branchId ? parseInt(branchId, 10) : null,
      assigned_name: assignedName.trim() || undefined,
      expires_in_hours: parseInt(expiresInHours, 10) || 48
    });
  };

  const handleCopy = () => {
    if (!generatedInvite?.deepLink) return;
    navigator.clipboard.writeText(generatedInvite.deepLink);
    setCopied(true);
    toast.success('Enlace copiado al portapapeles');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReset = () => {
    setGeneratedInvite(null);
    setBranchId('');
    setAssignedName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <QrCode className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Vincular Usuario a Telegram</h3>
              <p className="text-xs text-indigo-100">Deep Link con QR para auto-conexión directa</p>
            </div>
          </div>
          <button
            onClick={() => { handleReset(); onClose(); }}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!generatedInvite ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <p className="text-xs text-slate-500">
                Genera un código QR o enlace inteligente para que cualquier miembro del equipo se vincule al bot de Telegram sin escribir comandos confusos.
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Nombre o Rol del Usuario (Opcional)
                </label>
                <input
                  type="text"
                  value={assignedName}
                  onChange={(e) => setAssignedName(e.target.value)}
                  placeholder="Ej: Roberto - Gerencia, Carlos - Contador..."
                  className="w-full text-[13px] font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                  Sucursal Asignada
                </label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full text-[13px] font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">🌐 Acceso Global (Todas las sucursales)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      📍 {b.nombre}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Si dejas "Acceso Global", el usuario podrá consultar información de toda la empresa.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Validez del Enlace
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                  className="w-full text-[13px] font-medium border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="24">24 Horas</option>
                  <option value="48">48 Horas (Recomendado)</option>
                  <option value="168">7 Días</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {createMutation.isPending ? 'Generando...' : 'Generar QR y Enlace'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 flex flex-col items-center text-center">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl inline-block shadow-inner">
                <QRCodeSVG
                  value={generatedInvite.deepLink}
                  size={190}
                  level="M"
                  includeMargin={true}
                  className="rounded-lg"
                />
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-800">¡Escanea con Telegram!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Abre la cámara del teléfono o comparte el siguiente enlace directo con el usuario:
                </p>
              </div>

              <div className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInvite.deepLink}
                  className="bg-transparent text-xs text-slate-700 font-mono flex-1 outline-none px-2 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                  title="Copiar enlace"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={generatedInvite.deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center transition-colors"
                  title="Abrir en Telegram"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  ← Generar otro enlace
                </button>
                <button
                  type="button"
                  onClick={() => { handleReset(); onClose(); }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Listo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
