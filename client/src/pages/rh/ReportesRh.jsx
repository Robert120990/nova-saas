import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
    FileText,
    Building2,
    ShieldCheck,
    Receipt,
    Award,
    Users,
    Calendar,
    Filter,
    UserCheck,
    Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';
import SearchableSelect from '../../components/ui/SearchableSelect';

const REPORT_TABS = [
    {
        id: 'isss',
        label: 'Planilla de ISSS',
        icon: ShieldCheck,
        subtitle: 'Aportes al Régimen de Salud (Laboral 3% y Patronal 7.5%)',
        hasExcel: true
    },
    {
        id: 'afp',
        label: 'Planilla de AFP',
        icon: Building2,
        subtitle: 'Cotizaciones Previsionales agrupadas por Administradora',
        hasExcel: true
    },
    {
        id: 'renta',
        label: 'Informe Mensual Renta (ISR)',
        icon: Receipt,
        subtitle: 'Informe oficial de retenciones mensuales de ISR (F-910)',
        hasExcel: true
    },
    {
        id: 'constancia-sueldo',
        label: 'Constancia de Sueldo',
        icon: Award,
        subtitle: 'Certificación formal laboral con salario en letras y firma digital',
        hasExcel: false
    },
    {
        id: 'carta-renta',
        label: 'Carta de Renta',
        icon: FileText,
        subtitle: 'Constancia anual de retención de ISR para el ejercicio fiscal',
        hasExcel: false
    },
    {
        id: 'empleados',
        label: 'Listado de Empleados',
        icon: Users,
        subtitle: 'Directorio maestro de personal, cargos, departamentos y salarios',
        hasExcel: true
    }
];

const MESES = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
];

const ReportesRh = () => {
    const { tipo = 'isss' } = useParams();

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Active report type
    const activeTab = useMemo(() => {
        const found = REPORT_TABS.find(t => t.id === tipo);
        return found ? found.id : 'isss';
    }, [tipo]);

    // Filters state
    const [filters, setFilters] = useState({
        anio: currentYear,
        mes: currentMonth,
        quincena: 'todas',
        afp_id: 'all',
        empleado_id: '',
        dirigida_a: 'A QUIEN INTERESE',
        incluir_deducciones: true,
        estado: 'activos',
        cargo_id: 'all',
        departamento_id: 'all'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Revoke previous PDF URL when the report type changes
    useEffect(() => {
        if (pdfUrl) {
            URL.revokeObjectURL(pdfUrl);
            setPdfUrl(null);
        }
    }, [activeTab]);

    // Fetch filter catalogs
    const { data: catalogos = {} } = useQuery({
        queryKey: ['rh-reportes-catalogos'],
        queryFn: async () => (await axios.get('/api/rh/reportes/catalogos')).data,
        staleTime: 5 * 60 * 1000
    });

    const empleadosOptions = useMemo(() => {
        const emps = catalogos.empleados || [];
        return emps.map(e => ({
            id: e.id,
            codigo: e.codigo,
            nombre: `${e.codigo} - ${e.nombre}`
        }));
    }, [catalogos.empleados]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const activeConfig = useMemo(() => {
        return REPORT_TABS.find(t => t.id === activeTab) || REPORT_TABS[0];
    }, [activeTab]);

    // Validation
    const canGenerate = useMemo(() => {
        if (activeTab === 'constancia-sueldo') {
            return Boolean(filters.empleado_id);
        }
        if (activeTab === 'carta-renta') {
            return Boolean(filters.empleado_id && filters.anio);
        }
        return true;
    }, [activeTab, filters.empleado_id, filters.anio]);

    // Generate PDF
    const handleGenerate = async () => {
        if (!canGenerate) {
            if (activeTab === 'constancia-sueldo' || activeTab === 'carta-renta') {
                toast.error('Por favor seleccione un empleado');
            }
            return;
        }

        setIsGenerating(true);
        try {
            let endpoint = '';
            const params = {};

            switch (activeTab) {
                case 'isss':
                    endpoint = '/api/rh/reportes/isss';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'afp':
                    endpoint = '/api/rh/reportes/afp';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    params.afp_id = filters.afp_id;
                    break;
                case 'renta':
                    endpoint = '/api/rh/reportes/renta';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'constancia-sueldo':
                    endpoint = '/api/rh/reportes/constancia-sueldo';
                    params.empleado_id = filters.empleado_id;
                    params.dirigida_a = filters.dirigida_a;
                    params.incluir_deducciones = filters.incluir_deducciones;
                    break;
                case 'carta-renta':
                    endpoint = '/api/rh/reportes/carta-renta';
                    params.empleado_id = filters.empleado_id;
                    params.anio = filters.anio;
                    break;
                case 'empleados':
                    endpoint = '/api/rh/reportes/empleados';
                    params.estado = filters.estado;
                    params.cargo_id = filters.cargo_id;
                    params.departamento_id = filters.departamento_id;
                    break;
                default:
                    return;
            }

            const response = await axios.get(endpoint, {
                params,
                responseType: 'blob'
            });

            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
            }

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            toast.success(`${activeConfig.label} generado correctamente`);
        } catch (error) {
            console.error('Error generando reporte:', error);
            toast.error('Error al generar el reporte en PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    // Download PDF
    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        const cleanTitle = activeConfig.label.replace(/\s+/g, '_');
        link.setAttribute('download', `${cleanTitle}_${new Date().toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    // Export Excel
    const handleExportExcel = async () => {
        try {
            let endpoint = '';
            const params = { format: 'excel' };

            switch (activeTab) {
                case 'isss':
                    endpoint = '/api/rh/reportes/isss';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'afp':
                    endpoint = '/api/rh/reportes/afp';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    params.afp_id = filters.afp_id;
                    break;
                case 'renta':
                    endpoint = '/api/rh/reportes/renta';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'empleados':
                    endpoint = '/api/rh/reportes/empleados';
                    params.estado = filters.estado;
                    params.cargo_id = filters.cargo_id;
                    params.departamento_id = filters.departamento_id;
                    break;
                default:
                    return;
            }

            toast.info('Generando archivo Excel...');
            const response = await axios.get(endpoint, {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const cleanTitle = activeConfig.label.replace(/\s+/g, '_');
            link.setAttribute('download', `${cleanTitle}_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            toast.success('Archivo Excel descargado con éxito');
        } catch (error) {
            console.error('Error exportando Excel:', error);
            toast.error('Error al exportar reporte a Excel');
        }
    };

    return (
        <ReportLayout
                title={activeConfig.label}
                subtitle={activeConfig.subtitle}
                category="Recursos Humanos"
                pdfUrl={pdfUrl}
                isGenerating={isGenerating}
                onGenerate={handleGenerate}
                onDownload={handleDownload}
                canGenerate={canGenerate}
                generateButtonText={
                    activeTab === 'constancia-sueldo'
                        ? 'Generar Constancia'
                        : activeTab === 'carta-renta'
                        ? 'Generar Carta'
                        : 'Generar Reporte'
                }
                onExportExcel={activeConfig.hasExcel ? handleExportExcel : null}
            >
                {/* Filters Content */}
                <div className="space-y-4">
                    {/* Period filters for ISSS, AFP, Renta */}
                    {(activeTab === 'isss' || activeTab === 'afp' || activeTab === 'renta') && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Año
                                </label>
                                <select
                                    value={filters.anio}
                                    onChange={(e) => handleFilterChange('anio', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Mes
                                </label>
                                <select
                                    value={filters.mes}
                                    onChange={(e) => handleFilterChange('mes', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    {MESES.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Filter size={13} className="text-slate-400" />
                                    Quincena
                                </label>
                                <select
                                    value={filters.quincena}
                                    onChange={(e) => handleFilterChange('quincena', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="todas">Todo el Mes (Consolidado)</option>
                                    <option value="primera">Primera Quincena</option>
                                    <option value="segunda">Segunda Quincena</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Additional AFP filter */}
                    {activeTab === 'afp' && (
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                <Building2 size={13} className="text-slate-400" />
                                Institución Previsional
                            </label>
                            <select
                                value={filters.afp_id}
                                onChange={(e) => handleFilterChange('afp_id', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="all">TODAS LAS AFP</option>
                                {(catalogos.afps || []).map(a => (
                                    <option key={a.id} value={a.id}>{a.descripcion}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Filters for Constancia de Sueldo */}
                    {activeTab === 'constancia-sueldo' && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <UserCheck size={13} className="text-slate-400" />
                                    Empleado <span className="text-rose-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={empleadosOptions}
                                    value={filters.empleado_id}
                                    onChange={(_, opt) => handleFilterChange('empleado_id', opt?.id || '')}
                                    placeholder="Buscar empleado por código o nombre..."
                                    valueKey="id"
                                    labelKey="nombre"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Briefcase size={13} className="text-slate-400" />
                                    Dirigida a
                                </label>
                                <input
                                    type="text"
                                    value={filters.dirigida_a}
                                    onChange={(e) => handleFilterChange('dirigida_a', e.target.value)}
                                    placeholder="Ej: A QUIEN INTERESE o BANCO AGRICOLA"
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={filters.incluir_deducciones}
                                        onChange={(e) => handleFilterChange('incluir_deducciones', e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                    />
                                    <span className="text-[12px] font-semibold text-slate-700">
                                        Incluir Desglose de Deducciones de Ley
                                    </span>
                                </label>
                                <p className="text-[11px] text-slate-400 mt-1 pl-6">
                                    Muestra el recuadro formal con ISSS, AFP, renta y salario neto estimado.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Filters for Carta de Renta */}
                    {activeTab === 'carta-renta' && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <UserCheck size={13} className="text-slate-400" />
                                    Empleado <span className="text-rose-500">*</span>
                                </label>
                                <SearchableSelect
                                    options={empleadosOptions}
                                    value={filters.empleado_id}
                                    onChange={(_, opt) => handleFilterChange('empleado_id', opt?.id || '')}
                                    placeholder="Buscar empleado..."
                                    valueKey="id"
                                    labelKey="nombre"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Ejercicio Fiscal (Año)
                                </label>
                                <select
                                    value={filters.anio}
                                    onChange={(e) => handleFilterChange('anio', parseInt(e.target.value))}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    {[currentYear - 3, currentYear - 2, currentYear - 1, currentYear].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Filters for Listado de Empleados */}
                    {activeTab === 'empleados' && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Filter size={13} className="text-slate-400" />
                                    Estado
                                </label>
                                <select
                                    value={filters.estado}
                                    onChange={(e) => handleFilterChange('estado', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="activos">Solo Empleados Activos</option>
                                    <option value="inactivos">Solo Empleados Inactivos</option>
                                    <option value="todos">Todos los Estados</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Briefcase size={13} className="text-slate-400" />
                                    Cargo / Puesto
                                </label>
                                <select
                                    value={filters.cargo_id}
                                    onChange={(e) => handleFilterChange('cargo_id', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="all">TODOS LOS CARGOS</option>
                                    {(catalogos.cargos || []).map(c => (
                                        <option key={c.id} value={c.id}>{c.descripcion}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Building2 size={13} className="text-slate-400" />
                                    Departamento
                                </label>
                                <select
                                    value={filters.departamento_id}
                                    onChange={(e) => handleFilterChange('departamento_id', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="all">TODOS LOS DEPARTAMENTOS</option>
                                    {(catalogos.departamentos || []).map(d => (
                                        <option key={d.id} value={d.id}>{d.descripcion}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </ReportLayout>
    );
};

export default ReportesRh;
