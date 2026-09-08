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
    Briefcase,
    GraduationCap,
    Calculator,
    CreditCard,
    Clock,
    ClipboardList,
    Scale,
    Palmtree,
    ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';
import ReportLayout from '../../components/ui/ReportLayout';
import SearchableSelect from '../../components/ui/SearchableSelect';


const REPORT_TABS = [
    // 1. Obligaciones Legales y Aportes Patronales
    {
        id: 'isss',
        label: 'Planilla de ISSS',
        category: 'patronales',
        icon: ShieldCheck,
        subtitle: 'Aportes al Régimen de Salud (Laboral 3% y Patronal 7.5%)',
        hasExcel: true
    },
    {
        id: 'afp',
        label: 'Planilla de AFP',
        category: 'patronales',
        icon: Building2,
        subtitle: 'Cotizaciones Previsionales agrupadas por Administradora',
        hasExcel: true
    },
    {
        id: 'insaforp',
        label: 'Aportes INSAFORP / INCAF',
        category: 'patronales',
        icon: GraduationCap,
        subtitle: 'Planilla oficial del 1% patronal de formación profesional (INCAF)',
        hasExcel: true
    },
    {
        id: 'costo-laboral',
        label: 'Costo Laboral y Cargas Patronales',
        category: 'patronales',
        icon: Calculator,
        subtitle: 'Análisis gerencial de sueldos brutos, aportes y provisiones de ley',
        hasExcel: true
    },

    // 2. Retenciones y Descuentos a Terceros
    {
        id: 'renta',
        label: 'Informe Mensual Renta (ISR)',
        category: 'retenciones',
        icon: Receipt,
        subtitle: 'Informe oficial de retenciones mensuales de ISR (F-910)',
        hasExcel: true
    },
    {
        id: 'descuentos-terceros',
        label: 'Retenciones a Terceros',
        category: 'retenciones',
        icon: CreditCard,
        subtitle: 'Reporte consolidado de retenciones a PGR, Bancos, FSV y Anticipos',
        hasExcel: true
    },

    // 3. Control de Asistencia, Recargos y Novedades
    {
        id: 'horas-extras',
        label: 'Control de Horas Extras',
        category: 'asistencia',
        icon: Clock,
        subtitle: 'Detalle de horas diurnas, nocturnas, descansos trabajados y montos pagados',
        hasExcel: true
    },
    {
        id: 'acciones-personal',
        label: 'Historial Acciones de Personal',
        category: 'asistencia',
        icon: ClipboardList,
        subtitle: 'Registro de novedades, amonestaciones, suspensiones, permisos e incapacidades',
        hasExcel: true
    },

    // 4. Pasivos Laborales y Auditoría Anual
    {
        id: 'pasivos-laborales',
        label: 'Pasivos Laborales y Provisiones',
        category: 'pasivos',
        icon: Scale,
        subtitle: 'Cálculo a valor de cierre de indemnizaciones, vacaciones y aguinaldos acumulados',
        hasExcel: true
    },
    {
        id: 'control-vacaciones',
        label: 'Control de Vacaciones y Descansos',
        category: 'pasivos',
        icon: Palmtree,
        subtitle: 'Monitoreo de días devengados, gozados, pendientes y alertas de prescripción',
        hasExcel: true
    },
    {
        id: 'rotacion-personal',
        label: 'Estadísticas de Rotación (MTPS)',
        category: 'pasivos',
        icon: ArrowLeftRight,
        subtitle: 'Indicadores anuales de ingresos, bajas y tasa de rotación laboral',
        hasExcel: true
    },

    // 5. Certificaciones y Directorio
    {
        id: 'constancia-sueldo',
        label: 'Constancia de Sueldo',
        category: 'certificaciones',
        icon: Award,
        subtitle: 'Certificación formal laboral con salario en letras y firma digital',
        hasExcel: false
    },
    {
        id: 'carta-renta',
        label: 'Carta de Renta',
        category: 'certificaciones',
        icon: FileText,
        subtitle: 'Constancia anual de retención de ISR para el ejercicio fiscal',
        hasExcel: false
    },
    {
        id: 'empleados',
        label: 'Listado de Empleados',
        category: 'certificaciones',
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

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const todayStr = now.toISOString().split('T')[0];
    const firstDayOfYear = `${currentYear}-01-01`;

    // Active report type
    const activeTab = useMemo(() => {
        const found = REPORT_TABS.find(t => t.id === tipo);
        return found ? found.id : 'isss';
    }, [tipo]);

    const activeConfig = useMemo(() => {
        return REPORT_TABS.find(t => t.id === activeTab) || REPORT_TABS[0];
    }, [activeTab]);

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
        departamento_id: 'all',
        tipo_descuento: 'TODOS',
        tipo_accion: 'TODAS',
        fecha_inicio: firstDayOfYear,
        fecha_fin: `${currentYear}-12-31`,
        fecha_corte: todayStr,
        estado_vencimiento: 'TODOS',
        mes_inicio: 1,
        mes_fin: currentMonth
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

    // Validation
    const canGenerate = useMemo(() => {
        if (activeTab === 'constancia-sueldo') {
            return Boolean(filters.empleado_id);
        }
        if (activeTab === 'carta-renta') {
            return Boolean(filters.empleado_id && filters.anio);
        }
        if (activeTab === 'acciones-personal') {
            return Boolean(filters.fecha_inicio && filters.fecha_fin);
        }
        if (activeTab === 'pasivos-laborales') {
            return Boolean(filters.fecha_corte);
        }
        return true;
    }, [activeTab, filters.empleado_id, filters.anio, filters.fecha_inicio, filters.fecha_fin, filters.fecha_corte]);

    // Generate PDF
    const handleGenerate = async () => {
        if (!canGenerate) {
            if (activeTab === 'constancia-sueldo' || activeTab === 'carta-renta') {
                toast.error('Por favor seleccione un empleado');
            } else if (activeTab === 'acciones-personal') {
                toast.error('Por favor seleccione el rango de fechas');
            } else if (activeTab === 'pasivos-laborales') {
                toast.error('Por favor seleccione la fecha de corte');
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
                case 'insaforp':
                    endpoint = '/api/rh/reportes/insaforp';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'costo-laboral':
                    endpoint = '/api/rh/reportes/costo-laboral';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'renta':
                    endpoint = '/api/rh/reportes/renta';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'descuentos-terceros':
                    endpoint = '/api/rh/reportes/descuentos-terceros';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    params.tipo_descuento = filters.tipo_descuento;
                    break;
                case 'horas-extras':
                    endpoint = '/api/rh/reportes/horas-extras';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    params.empleado_id = filters.empleado_id || undefined;
                    break;
                case 'acciones-personal':
                    endpoint = '/api/rh/reportes/acciones-personal';
                    params.fecha_inicio = filters.fecha_inicio;
                    params.fecha_fin = filters.fecha_fin;
                    params.tipo_accion = filters.tipo_accion;
                    params.empleado_id = filters.empleado_id || undefined;
                    break;
                case 'pasivos-laborales':
                    endpoint = '/api/rh/reportes/pasivos-laborales';
                    params.fecha_corte = filters.fecha_corte;
                    params.departamento_id = filters.departamento_id;
                    break;
                case 'control-vacaciones':
                    endpoint = '/api/rh/reportes/control-vacaciones';
                    params.anio = filters.anio;
                    params.estado_vencimiento = filters.estado_vencimiento;
                    params.departamento_id = filters.departamento_id;
                    break;
                case 'rotacion-personal':
                    endpoint = '/api/rh/reportes/rotacion-personal';
                    params.anio = filters.anio;
                    params.mes_inicio = filters.mes_inicio;
                    params.mes_fin = filters.mes_fin;
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
                case 'insaforp':
                    endpoint = '/api/rh/reportes/insaforp';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'costo-laboral':
                    endpoint = '/api/rh/reportes/costo-laboral';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'renta':
                    endpoint = '/api/rh/reportes/renta';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    break;
                case 'descuentos-terceros':
                    endpoint = '/api/rh/reportes/descuentos-terceros';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    params.tipo_descuento = filters.tipo_descuento;
                    break;
                case 'horas-extras':
                    endpoint = '/api/rh/reportes/horas-extras';
                    params.anio = filters.anio;
                    params.mes = filters.mes;
                    params.quincena = filters.quincena;
                    params.empleado_id = filters.empleado_id || undefined;
                    break;
                case 'acciones-personal':
                    endpoint = '/api/rh/reportes/acciones-personal';
                    params.fecha_inicio = filters.fecha_inicio;
                    params.fecha_fin = filters.fecha_fin;
                    params.tipo_accion = filters.tipo_accion;
                    params.empleado_id = filters.empleado_id || undefined;
                    break;
                case 'pasivos-laborales':
                    endpoint = '/api/rh/reportes/pasivos-laborales';
                    params.fecha_corte = filters.fecha_corte;
                    params.departamento_id = filters.departamento_id;
                    break;
                case 'control-vacaciones':
                    endpoint = '/api/rh/reportes/control-vacaciones';
                    params.anio = filters.anio;
                    params.estado_vencimiento = filters.estado_vencimiento;
                    params.departamento_id = filters.departamento_id;
                    break;
                case 'rotacion-personal':
                    endpoint = '/api/rh/reportes/rotacion-personal';
                    params.anio = filters.anio;
                    params.mes_inicio = filters.mes_inicio;
                    params.mes_fin = filters.mes_fin;
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
                    {/* Period filters for Monthly Payroll Reports (ISSS, AFP, INSAFORP, Costo Laboral, Renta, Descuentos Terceros, Horas Extras) */}
                    {['isss', 'afp', 'insaforp', 'costo-laboral', 'renta', 'descuentos-terceros', 'horas-extras'].includes(activeTab) && (
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

                    {/* Descuentos Terceros specific filter */}
                    {activeTab === 'descuentos-terceros' && (
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                <Filter size={13} className="text-slate-400" />
                                Tipo de Descuento
                            </label>
                            <select
                                value={filters.tipo_descuento}
                                onChange={(e) => handleFilterChange('tipo_descuento', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            >
                                <option value="TODOS">TODOS LOS DESCUENTOS</option>
                                <option value="PGR">Procuraduría (PGR)</option>
                                <option value="BANCO">Préstamos Bancarios</option>
                                <option value="FSV">Fondo Social para la Vivienda (FSV)</option>
                                <option value="COOPERATIVA">Cooperativas / Asociaciones</option>
                                <option value="ANTICIPO">Anticipos Saláriales</option>
                                <option value="OTRO">Otros Descuentos</option>
                            </select>
                        </div>
                    )}

                    {/* Horas Extras specific filter: optional employee */}
                    {activeTab === 'horas-extras' && (
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                <UserCheck size={13} className="text-slate-400" />
                                Empleado (Opcional)
                            </label>
                            <SearchableSelect
                                options={[{ id: '', nombre: 'TODOS LOS EMPLEADOS' }, ...empleadosOptions]}
                                value={filters.empleado_id}
                                onChange={(_, opt) => handleFilterChange('empleado_id', opt?.id || '')}
                                placeholder="Todos los empleados o busque por nombre..."
                                valueKey="id"
                                labelKey="nombre"
                            />
                        </div>
                    )}

                    {/* Filters for Acciones de Personal */}
                    {activeTab === 'acciones-personal' && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Fecha Desde <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={filters.fecha_inicio}
                                    onChange={(e) => handleFilterChange('fecha_inicio', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Fecha Hasta <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={filters.fecha_fin}
                                    onChange={(e) => handleFilterChange('fecha_fin', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Filter size={13} className="text-slate-400" />
                                    Tipo de Acción
                                </label>
                                <select
                                    value={filters.tipo_accion}
                                    onChange={(e) => handleFilterChange('tipo_accion', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="TODAS">TODAS LAS ACCIONES</option>
                                    <option value="amonestacion">Amonestaciones</option>
                                    <option value="suspension">Suspensiones</option>
                                    <option value="permiso">Permisos</option>
                                    <option value="incapacidad">Incapacidades</option>
                                    <option value="despido">Despido / Terminación</option>
                                    <option value="otro">Otras Medidas</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <UserCheck size={13} className="text-slate-400" />
                                    Empleado (Opcional)
                                </label>
                                <SearchableSelect
                                    options={[{ id: '', nombre: 'TODOS LOS EMPLEADOS' }, ...empleadosOptions]}
                                    value={filters.empleado_id}
                                    onChange={(_, opt) => handleFilterChange('empleado_id', opt?.id || '')}
                                    placeholder="Todos los empleados o busque por nombre..."
                                    valueKey="id"
                                    labelKey="nombre"
                                />
                            </div>
                        </>
                    )}

                    {/* Filters for Pasivos Laborales */}
                    {activeTab === 'pasivos-laborales' && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Fecha de Corte <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={filters.fecha_corte}
                                    onChange={(e) => handleFilterChange('fecha_corte', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
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

                    {/* Filters for Control de Vacaciones */}
                    {activeTab === 'control-vacaciones' && (
                        <>
                            <div>
                                <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5 mb-1.5">
                                    <Calendar size={13} className="text-slate-400" />
                                    Año de Análisis
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
                                    <Filter size={13} className="text-slate-400" />
                                    Estado de Vacaciones
                                </label>
                                <select
                                    value={filters.estado_vencimiento}
                                    onChange={(e) => handleFilterChange('estado_vencimiento', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                >
                                    <option value="TODOS">TODOS LOS ESTADOS</option>
                                    <option value="VENCIDAS">Vencidas / Prescritas (&gt; 1 año de retraso)</option>
                                    <option value="POR_VENCER">Por Vencer (Próximas a vencer)</option>
                                    <option value="AL_DIA">Al Día (Período corriente)</option>
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

                    {/* Filters for Rotación de Personal */}
                    {activeTab === 'rotacion-personal' && (
                        <>
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

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                                        Mes Desde
                                    </label>
                                    <select
                                        value={filters.mes_inicio}
                                        onChange={(e) => handleFilterChange('mes_inicio', parseInt(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        {MESES.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">
                                        Mes Hasta
                                    </label>
                                    <select
                                        value={filters.mes_fin}
                                        onChange={(e) => handleFilterChange('mes_fin', parseInt(e.target.value))}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    >
                                        {MESES.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </>
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
