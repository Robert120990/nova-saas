const pool = require('../config/db');

const LEGACY_SEED_NIT = '0614-140268-004-3';
const LEGACY_SEED_DUI = '00497414-6';
const LEGACY_SEED_NAME = 'RAUL RAFAEL SOSA CASTELLANOS';

const DEFAULT_PATRONO = {
    patrono_nombre: '',
    patrono_edad: null,
    patrono_sexo: '',
    patrono_estado_civil: '',
    patrono_profesion: '',
    patrono_direccion: '',
    patrono_nacionalidad: 'SALVADOREÑA',
    patrono_dui: '',
    patrono_dui_extendido: '',
    patrono_nit: ''
};

function normalizeLegalName(name) {
    if (!name) return '';
    return String(name)
        .trim()
        .replace(/\bS\s*,\s*A\s*,/gi, 'S.A.')
        .replace(/\bC\s*,\s*V\s*[,.]?/gi, 'C.V.');
}

function isLegacyPatronoSeed(row, companyNit = '') {
    if (!row) return false;
    const cleanCompanyNit = String(companyNit || '').trim();
    if (cleanCompanyNit === LEGACY_SEED_NIT) return false;

    const rowNit = String(row.patrono_nit || '').trim();
    const rowDui = String(row.patrono_dui || '').trim();
    const rowName = String(row.patrono_nombre || '').trim().toUpperCase();
    const rowProfession = String(row.patrono_profesion || '').trim().toUpperCase();

    if (rowNit === LEGACY_SEED_NIT) return true;
    if (rowName === LEGACY_SEED_NAME && rowDui === LEGACY_SEED_DUI && rowProfession === 'ESTUDIANTE') {
        return true;
    }
    return false;
}

function sanitizeRhConfigRow(cfgRow = {}, companyNit = '') {
    const contaminated = isLegacyPatronoSeed(cfgRow, companyNit);
    const hasPatrono = Boolean(!contaminated && cfgRow.patrono_nombre && String(cfgRow.patrono_nombre).trim());

    return {
        ...cfgRow,
        patrono_nombre: hasPatrono ? String(cfgRow.patrono_nombre).trim() : '',
        patrono_edad: hasPatrono && Number(cfgRow.patrono_edad) > 0 ? Number(cfgRow.patrono_edad) : null,
        patrono_sexo: hasPatrono ? String(cfgRow.patrono_sexo || '').trim() : '',
        patrono_estado_civil: hasPatrono ? String(cfgRow.patrono_estado_civil || '').trim() : '',
        patrono_profesion: hasPatrono ? String(cfgRow.patrono_profesion || '').trim() : '',
        patrono_direccion: contaminated ? '' : String(cfgRow.patrono_direccion || '').trim(),
        patrono_nacionalidad: (!contaminated && String(cfgRow.patrono_nacionalidad || '').trim()) || DEFAULT_PATRONO.patrono_nacionalidad,
        patrono_dui: hasPatrono ? String(cfgRow.patrono_dui || '').trim() : '',
        patrono_dui_extendido: hasPatrono ? String(cfgRow.patrono_dui_extendido || '').trim() : '',
        patrono_nit: contaminated ? '' : String(cfgRow.patrono_nit || '').trim()
    };
}

async function fetchPatronoConfig(companyId) {
    const [[cfgRows], [compRows], [branchRows]] = await Promise.all([
        pool.query(
            `SELECT patrono_nombre, patrono_edad, patrono_sexo, patrono_estado_civil,
                    patrono_profesion, patrono_direccion, patrono_nacionalidad,
                    patrono_dui, patrono_dui_extendido, patrono_nit
             FROM rh_config WHERE company_id = ? LIMIT 1`,
            [companyId]
        ),
        pool.query(
            `SELECT razon_social, nombre_comercial, nit, direccion, tipo_persona
             FROM companies WHERE id = ? LIMIT 1`,
            [companyId]
        ),
        pool.query(
            `SELECT direccion FROM branches
             WHERE company_id = ? AND direccion IS NOT NULL AND TRIM(direccion) != ''
             ORDER BY es_casa_matriz DESC, id ASC LIMIT 1`,
            [companyId]
        )
    ]);

    const cfg = cfgRows[0] || {};
    const comp = compRows[0] || {};
    const branch = branchRows[0] || {};

    const companyRazonSocial = normalizeLegalName(comp.razon_social || comp.nombre_comercial || '');
    const companyNit = String(comp.nit || '').trim();
    const companyDireccion = String(comp.direccion || '').trim() || String(branch.direccion || '').trim();
    const companyTipoPersona = String(comp.tipo_persona || '').trim();

    const cleanCfg = sanitizeRhConfigRow(cfg, companyNit);
    const hasConfiguredPatrono = Boolean(cleanCfg.patrono_nombre);

    return {
        company_razon_social: companyRazonSocial,
        company_nit: companyNit,
        company_direccion: companyDireccion,
        company_tipo_persona: companyTipoPersona,
        has_configured_patrono: hasConfiguredPatrono,
        patrono_nombre: hasConfiguredPatrono ? cleanCfg.patrono_nombre : (companyRazonSocial || DEFAULT_PATRONO.patrono_nombre),
        patrono_edad: hasConfiguredPatrono ? cleanCfg.patrono_edad : DEFAULT_PATRONO.patrono_edad,
        patrono_sexo: hasConfiguredPatrono ? cleanCfg.patrono_sexo : DEFAULT_PATRONO.patrono_sexo,
        patrono_estado_civil: hasConfiguredPatrono ? cleanCfg.patrono_estado_civil : DEFAULT_PATRONO.patrono_estado_civil,
        patrono_profesion: hasConfiguredPatrono ? cleanCfg.patrono_profesion : DEFAULT_PATRONO.patrono_profesion,
        patrono_direccion: cleanCfg.patrono_direccion || companyDireccion || DEFAULT_PATRONO.patrono_direccion,
        patrono_nacionalidad: cleanCfg.patrono_nacionalidad || DEFAULT_PATRONO.patrono_nacionalidad,
        patrono_dui: hasConfiguredPatrono ? cleanCfg.patrono_dui : DEFAULT_PATRONO.patrono_dui,
        patrono_dui_extendido: hasConfiguredPatrono ? cleanCfg.patrono_dui_extendido : DEFAULT_PATRONO.patrono_dui_extendido,
        patrono_nit: cleanCfg.patrono_nit || companyNit || DEFAULT_PATRONO.patrono_nit
    };
}

function resolveContratoPatrono(record = {}, patronoCfg = {}) {
    const contaminated = isLegacyPatronoSeed(record, patronoCfg.company_nit);
    const recName = contaminated ? '' : normalizeLegalName(record.patrono_nombre || '');
    const compNameUpper = String(patronoCfg.company_razon_social || '').toUpperCase();
    const recNameUpper = recName.toUpperCase();
    const recHasDui = Boolean(!contaminated && record.patrono_dui && String(record.patrono_dui).trim());

    const useCompanyConfig =
        contaminated ||
        !recName ||
        (recNameUpper === compNameUpper && !recHasDui);

    if (useCompanyConfig) {
        const isCorporateEntityOnly = !patronoCfg.has_configured_patrono && (
            String(patronoCfg.company_tipo_persona || '') === '2' ||
            /S\.?A\.?|C\.?V\.?|SOCIEDAD|LTDA|LIMITADA|R\.L\./i.test(compNameUpper)
        );
        const rawRecNac = !contaminated ? String(record.patrono_nacionalidad || '').trim().toUpperCase() : '';
        const resolvedNac = isCorporateEntityOnly
            ? (rawRecNac && rawRecNac !== 'SALVADOREÑO' ? rawRecNac : DEFAULT_PATRONO.patrono_nacionalidad)
            : (rawRecNac || patronoCfg.patrono_nacionalidad || DEFAULT_PATRONO.patrono_nacionalidad);

        return {
            company_razon_social: patronoCfg.company_razon_social || '',
            company_tipo_persona: patronoCfg.company_tipo_persona || '',
            patrono_nombre: patronoCfg.patrono_nombre || '',
            patrono_edad: patronoCfg.patrono_edad ?? null,
            patrono_sexo: patronoCfg.patrono_sexo || '',
            patrono_estado_civil: patronoCfg.patrono_estado_civil || '',
            patrono_profesion: patronoCfg.patrono_profesion || '',
            patrono_direccion: (!contaminated && String(record.patrono_direccion || '').trim()) || patronoCfg.patrono_direccion || '',
            patrono_nacionalidad: resolvedNac,
            patrono_dui: patronoCfg.patrono_dui || '',
            patrono_dui_extendido: patronoCfg.patrono_dui_extendido || '',
            patrono_nit: (!contaminated && String(record.patrono_nit || '').trim()) || patronoCfg.patrono_nit || ''
        };
    }

    return {
        company_razon_social: patronoCfg.company_razon_social || '',
        company_tipo_persona: patronoCfg.company_tipo_persona || '',
        patrono_nombre: recName,
        patrono_edad: Number(record.patrono_edad) > 0 ? Number(record.patrono_edad) : null,
        patrono_sexo: String(record.patrono_sexo || '').trim(),
        patrono_estado_civil: String(record.patrono_estado_civil || '').trim(),
        patrono_profesion: String(record.patrono_profesion || '').trim(),
        patrono_direccion: String(record.patrono_direccion || '').trim() || patronoCfg.patrono_direccion || '',
        patrono_nacionalidad: String(record.patrono_nacionalidad || '').trim() || patronoCfg.patrono_nacionalidad || DEFAULT_PATRONO.patrono_nacionalidad,
        patrono_dui: String(record.patrono_dui || '').trim(),
        patrono_dui_extendido: String(record.patrono_dui_extendido || '').trim(),
        patrono_nit: String(record.patrono_nit || '').trim() || patronoCfg.patrono_nit || ''
    };
}

module.exports = {
    DEFAULT_PATRONO,
    LEGACY_SEED_NIT,
    normalizeLegalName,
    isLegacyPatronoSeed,
    sanitizeRhConfigRow,
    fetchPatronoConfig,
    resolveContratoPatrono
};

