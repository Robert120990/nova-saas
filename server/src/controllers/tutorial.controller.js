const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const tutorialPdfService = require('../services/tutorialPdf.service');
const {
    TUTORIALS_CATALOG,
    TUTORIAL_CATEGORIES,
    ROLE_GUIDES
} = require('../data/tutorialsCatalog');

const normalizeRole = (name) => String(name || '').trim().toLowerCase();

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

    const isSuperAdmin = normalizeRole(roleName) === 'superadmin';
    return { roleName, userPerms, isSuperAdmin };
}

function resolveSingleRoleGuide(roleName, tutorials) {
    const target = normalizeRole(roleName);
    const match = ROLE_GUIDES.find(g => normalizeRole(g.role) === target);
    if (match) {
        return match;
    }
    return {
        role: roleName,
        badge: 'Rol Conectado',
        color: 'indigo',
        summary: 'Guías paso a paso habilitadas exclusivamente para los módulos y permisos asignados a tu rol activo.',
        highlights: (Array.isArray(tutorials) ? tutorials : []).slice(0, 3).map(t => t.title)
    };
}

function filterTutorialsForUser(tutorials, { roleName, userPerms, isSuperAdmin }, { category } = {}) {
    const activeRoleKey = normalizeRole(roleName);
    const roleHasExplicitMapping = TUTORIALS_CATALOG.some(
        t => Array.isArray(t.roles) && t.roles.some(r => normalizeRole(r) === activeRoleKey)
    );

    return tutorials
        .filter((t) => {
            const matchesPerm = isSuperAdmin || !Array.isArray(t.requiredPermissions) || t.requiredPermissions.length === 0
                ? true
                : t.requiredPermissions.some(p => userPerms.includes(p));

            const matchesRole = isSuperAdmin
                ? true
                : roleHasExplicitMapping
                    ? (Array.isArray(t.roles) && t.roles.some(r => normalizeRole(r) === activeRoleKey))
                    : true;

            if (!matchesPerm || !matchesRole) {
                return false;
            }
            if (category && category !== 'all' && t.category !== category) {
                return false;
            }
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
        const allRoleTutorials = filterTutorialsForUser(TUTORIALS_CATALOG, ctx);
        const availableCategoryIds = new Set(allRoleTutorials.map(t => t.category));
        const categories = TUTORIAL_CATEGORIES.filter(c => availableCategoryIds.has(c.id));
        const roleGuide = resolveSingleRoleGuide(ctx.roleName, allRoleTutorials);

        const tutorials = req.query.category && req.query.category !== 'all'
            ? allRoleTutorials.filter(t => t.category === req.query.category)
            : allRoleTutorials;

        res.json({
            success: true,
            userRole: ctx.roleName,
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
        const allowed = filterTutorialsForUser([tutorial], ctx);
        if (allowed.length === 0) {
            return res.status(403).json({ success: false, message: 'Su rol actual no tiene acceso a este tutorial' });
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
        const tutorials = filterTutorialsForUser(TUTORIALS_CATALOG, ctx, { category });

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
    getTutorialPackPdf
};
