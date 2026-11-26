const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const tutorialPdfService = require('../services/tutorialPdf.service');
const {
    TUTORIALS_CATALOG,
    TUTORIAL_CATEGORIES,
    ROLE_GUIDES
} = require('../data/tutorialsCatalog');

const DEFAULT_STANDARD_MODULES = [
    'sales',
    'purchases',
    'inventory',
    'accounting',
    'human_resources',
    'gas_station',
    'pozo'
];

const DEFAULT_ANDELSA_MODULES = [
    'sales',
    'purchases',
    'inventory',
    'accounting',
    'human_resources',
    'egg_industrial',
    'crm'
];

const normalizeRole = (name) => String(name || '').trim().toLowerCase();

function resolveCompanyEnabledModules(companyRow, companyId) {
    const companyName = companyRow?.razon_social || '';
    const isAndelsa = Number(companyId) === 9 || companyName.toUpperCase().includes('ANDELSA');

    let modules = null;
    if (companyRow?.enabled_modules !== undefined && companyRow?.enabled_modules !== null) {
        if (Array.isArray(companyRow.enabled_modules)) {
            modules = [...companyRow.enabled_modules];
        } else if (typeof companyRow.enabled_modules === 'string') {
            try {
                const parsed = JSON.parse(companyRow.enabled_modules);
                if (Array.isArray(parsed)) modules = [...parsed];
            } catch {
                modules = null;
            }
        }
    }

    if (!modules) {
        modules = isAndelsa ? [...DEFAULT_ANDELSA_MODULES] : [...DEFAULT_STANDARD_MODULES];
    }

    if (isAndelsa) {
        if (!modules.includes('egg_industrial')) modules.push('egg_industrial');
        if (!modules.includes('crm')) modules.push('crm');
    }

    return { companyName, enabledModules: modules };
}

async function resolveUserRoleContext(req) {
    const userId = req.user?.id;
    const companyId = req.company_id;
    let roleName = req.user?.role || 'Vendedor';
    let userPerms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];

    if (userId && companyId) {
        const [rows] = await pool.query(
            `SELECT r.name as role_name, r.permissions
             FROM usuario_empresa ue
             JOIN roles r ON ue.role_id = r.id
             WHERE ue.usuario_id = ? AND ue.empresa_id = ? AND ue.has_access = 1
             LIMIT 1`,
            [userId, companyId]
        );
        if (rows.length > 0) {
            roleName = rows[0].role_name || roleName;
            try {
                const parsed = typeof rows[0].permissions === 'string'
                    ? JSON.parse(rows[0].permissions)
                    : rows[0].permissions;
                if (Array.isArray(parsed)) userPerms = parsed;
            } catch { /* keep fallback */ }
        }
    }

    let companyRow = null;
    if (companyId) {
        const [compRows] = await pool.query(
            'SELECT id, razon_social, enabled_modules FROM companies WHERE id = ? LIMIT 1',
            [companyId]
        );
        companyRow = compRows[0] || null;
    }

    const { companyName, enabledModules } = resolveCompanyEnabledModules(companyRow, companyId);
    const isSuperAdmin = normalizeRole(roleName) === 'superadmin';

    return { roleName, userPerms, isSuperAdmin, companyName, enabledModules };
}

function resolveSingleRoleGuide(roleName, tutorials, enabledModules = []) {
    const target = normalizeRole(roleName);
    const match = ROLE_GUIDES.find(g => normalizeRole(g.role) === target);
    const isIndustrialContext = Array.isArray(enabledModules)
        && enabledModules.includes('egg_industrial')
        && !enabledModules.includes('gas_station');

    if (match) {
        if (isIndustrialContext && match.industrialSummary) {
            return {
                ...match,
                badge: match.industrialBadge || match.badge,
                summary: match.industrialSummary,
                highlights: Array.isArray(match.industrialHighlights) && match.industrialHighlights.length > 0
                    ? match.industrialHighlights
                    : match.highlights
            };
        }
        return match;
    }
    return {
        role: roleName,
        badge: isIndustrialContext ? 'Rol Operativo Planta' : 'Rol Conectado',
        color: isIndustrialContext ? 'cyan' : 'indigo',
        summary: 'Guías paso a paso habilitadas dinámicamente para los módulos y permisos asignados a tu rol activo.',
        highlights: (Array.isArray(tutorials) ? tutorials : []).slice(0, 3).map(t => t.title)
    };
}

function filterTutorialsForUser(
    tutorials,
    { roleName, userPerms, isSuperAdmin, enabledModules = [] },
    { category, includeAllModules = false } = {}
) {
    const bypassModuleFilter = Boolean(isSuperAdmin && includeAllModules);

    return tutorials
        .filter((t) => {
            const matchesModule = !t.requiredModule
                || bypassModuleFilter
                || (Array.isArray(enabledModules) && enabledModules.includes(t.requiredModule));

            if (!matchesModule) return false;

            const matchesPerm = isSuperAdmin || !Array.isArray(t.requiredPermissions) || t.requiredPermissions.length === 0
                ? true
                : t.requiredPermissions.some(p => userPerms.includes(p));

            if (!matchesPerm) return false;
            if (category && category !== 'all' && t.category !== category) return false;
            return true;
        })
        .map((t) => ({
            ...t,
            roles: [roleName],
            isRecommendedForUser: true
        }))
        .sort((a, b) => (a.order || 999) - (b.order || 999));
}

const getTutorials = async (req, res) => {
    try {
        const ctx = await resolveUserRoleContext(req);
        const includeAllModules = ctx.isSuperAdmin && (req.query.allModules === '1' || req.query.allModules === 'true');
        const allRoleTutorials = filterTutorialsForUser(TUTORIALS_CATALOG, ctx, { includeAllModules });
        const availableCategoryIds = new Set(allRoleTutorials.map(t => t.category));
        const categories = TUTORIAL_CATEGORIES.filter(c => availableCategoryIds.has(c.id));
        const roleGuide = resolveSingleRoleGuide(ctx.roleName, allRoleTutorials, ctx.enabledModules);

        const tutorials = req.query.category && req.query.category !== 'all'
            ? allRoleTutorials.filter(t => t.category === req.query.category)
            : allRoleTutorials;

        res.json({
            success: true,
            userRole: ctx.roleName,
            isSuperAdmin: ctx.isSuperAdmin,
            companyName: ctx.companyName,
            enabledModules: ctx.enabledModules,
            roleGuide,
            roleGuides: [roleGuide],
            categories,
            tutorials
        });
    } catch (error) {
        console.error('[tutorialController.getTutorials] Error:', error);
        res.status(500).json({ success: false, message: 'Error al cargar los tutoriales', error: error.message });
    }
};

const getTutorialPdf = async (req, res) => {
    try {
        const { slug } = req.params;
        const tutorial = TUTORIALS_CATALOG.find(t => t.slug === slug);
        if (!tutorial) {
            return res.status(404).json({ success: false, message: 'Tutorial no encontrado' });
        }

        const ctx = await resolveUserRoleContext(req);
        const allowed = filterTutorialsForUser([tutorial], ctx, { includeAllModules: ctx.isSuperAdmin });
        if (allowed.length === 0) {
            return res.status(403).json({ success: false, message: 'Su rol o empresa actual no tiene acceso a este tutorial' });
        }

        const company = await reportPdfHelper.getCompanyInfo(req.company_id);
        const pdfBuffer = await tutorialPdfService.generateTutorialPdfBuffer(allowed[0], company);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Tutorial_${slug}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[tutorialController.getTutorialPdf] Error:', error);
        res.status(500).json({ success: false, message: 'Error al generar el PDF del tutorial', error: error.message });
    }
};

const getTutorialPackPdf = async (req, res) => {
    try {
        const { category = 'all' } = req.query;
        const ctx = await resolveUserRoleContext(req);
        const includeAllModules = ctx.isSuperAdmin && (req.query.allModules === '1' || req.query.allModules === 'true');
        const tutorials = filterTutorialsForUser(TUTORIALS_CATALOG, ctx, { category, includeAllModules });

        if (tutorials.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay tutoriales disponibles para exportar con ese filtro' });
        }

        const company = await reportPdfHelper.getCompanyInfo(req.company_id);
        const titleParts = ['MANUAL OPERATIVO DE USUARIO'];
        if (category && category !== 'all') {
            const cat = TUTORIAL_CATEGORIES.find(c => c.id === category);
            if (cat) titleParts.push(cat.label.toUpperCase());
        }
        const subtitle = `ROL ACTIVO: ${ctx.roleName.toUpperCase()} (${tutorials.length} GUÍAS)`;
        const safeRoleSlug = String(ctx.roleName || 'Usuario')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_');

        const pdfBuffer = await tutorialPdfService.generateTutorialPackPdfBuffer(
            tutorials,
            titleParts.join(' — '),
            subtitle,
            company
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Manual_Operativo_${safeRoleSlug}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('[tutorialController.getTutorialPackPdf] Error:', error);
        res.status(500).json({ success: false, message: 'Error al generar el manual consolidado PDF', error: error.message });
    }
};

module.exports = {
    getTutorials,
    getTutorialPdf,
    getTutorialPackPdf,
    filterTutorialsForUser,
    resolveCompanyEnabledModules
};
