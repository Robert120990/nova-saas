import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { MessageCircle, Save, GitBranch, Eye, EyeOff, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const WhatsAppConfig = () => {
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [showToken, setShowToken] = useState(false);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await axios.get('/api/branches')).data,
  });

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0].id);
    }
  }, [branches, selectedBranchId]);

  const { data: wspSettings, isLoading } = useQuery({
    queryKey: ['whatsapp-settings', selectedBranchId],
    queryFn: async () => (await axios.get(`/api/whatsapp/${selectedBranchId}`)).data,
    enabled: !!selectedBranchId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => axios.post('/api/whatsapp', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['whatsapp-settings', selectedBranchId]);
      toast.success('Configuración WhatsApp guardada');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const testMutation = useMutation({
    mutationFn: (data) => axios.post('/api/whatsapp/test', data),
    onSuccess: () => toast.success('Mensaje de prueba enviado correctamente'),
    onError: (err) => toast.error(err.response?.data?.message || 'Error de conexión'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    data.branch_id = selectedBranchId;
    saveMutation.mutate(data);
  };

  const handleTest = () => {
    testMutation.mutate({ branch_id: selectedBranchId });
  };

  const inputCls = "w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all text-sm font-medium shadow-sm";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <MessageCircle size={28} className="text-indigo-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Configuración WhatsApp</h2>
          <p className="text-slate-500 font-medium">WhatsApp Cloud API de Meta</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <ExternalLink size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-bold mb-1">¿No tienes una cuenta de WhatsApp Business API?</p>
          <p>WhatsApp Cloud API requiere un número registrado en Meta Business Platform. 
          Visita <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-amber-900 underline font-bold">developers.facebook.com</a> 
          {' '}para crear una aplicación y obtener tus credenciales.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Seleccionar Sucursal</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => setSelectedBranchId(branch.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all border-b border-slate-50 last:border-0 ${
                  selectedBranchId === branch.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <GitBranch size={18} className={selectedBranchId === branch.id ? 'text-indigo-600' : 'text-slate-400'} />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{branch.nombre}</span>
                  <span className="text-[10px] opacity-70 uppercase font-bold tracking-wider">{branch.codigo}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedBranchId ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-20 text-center">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <span className="text-slate-400 font-medium">Cargando configuración...</span>
                </div>
              ) : (
                <form key={selectedBranchId} onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <MessageCircle size={16} className="text-green-600" />
                    <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Credenciales WhatsApp Cloud API</h4>
                  </div>

                  <div>
                    <label className={labelCls}>Phone Number ID</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        name="phone_number_id"
                        defaultValue={wspSettings?.phone_number_id}
                        required
                        placeholder="123456789012345"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Token de Acceso</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        name="token"
                        type={showToken ? 'text' : 'password'}
                        defaultValue={wspSettings?.token}
                        required
                        placeholder="EAAx..."
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Número de teléfono emisor</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        name="from_phone"
                        defaultValue={wspSettings?.from_phone}
                        required
                        placeholder="50370000000"
                        className={inputCls}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 ml-1">Formato: código de país + número, sin signos (ej: 50370000000)</p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testMutation.isPending || saveMutation.isPending}
                      className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 size={20} className="text-green-600" />
                      {testMutation.isPending ? 'Probando...' : 'Probar Conexión'}
                    </button>
                    <button
                      type="submit"
                      disabled={saveMutation.isPending || testMutation.isPending}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50"
                    >
                      <Save size={20} />
                      {saveMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-20 text-center">
              <MessageCircle className="mx-auto text-slate-200 mb-4" size={48} />
              <p className="text-slate-400 font-medium italic">Selecciona una sucursal para configurar WhatsApp</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConfig;
