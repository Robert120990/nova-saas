const pool = require('../config/db');
const reportPdfHelper = require('../utils/reportPdfHelper');
const tutorialPdfService = require('../services/tutorialPdf.service');
const {
    TUTORIALS_CATALOG,
    TUTORIAL_CATEGORIES,
    ROLE_GUIDES
} = require('../data/tutorialsCatalog');

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

    const isSuperAdmin = String(roleName).toLowerCase() === 'superadmin';
    const isAdminViewer = isSuperAdmin || ['admin', 'administrador', 'gerencia', 'supervisor'].includes(String(roleName).toLowerCase());
    return { roleName, userPerms, isSuperAdmin, isAdminViewer };
}

function filterTutorialsForUser(tutorials, { roleName, userPerms, isSuperAdmin, isAdminViewer }, { category, role, includeAll } = {}) {
    return tutorials
        .map((t) => {
            const matchesPerm = isSuperAdmin || !Array.isArray(t.requiredPermissions) || t.requiredPermissions.length === 0
                ? true
                : t.requiredPermissions.some(p => userPerms.includes(p));
            return {
                ...t,
                isRecommendedForUser: matchesPerm
            };
        })
        .filter((t) => {
            if (!(includeAll && isAdminViewer) && !isSuperAdmin && !t.isRecommendedForUser) {
                return false;
            }
            if (category && category !== 'all' && t.category !== category) {
                return false;
            }
            if (role && role !== 'all' && !(Array.isArray(t.roles) && t.roles.includes(role))) {
                return false;
            }
            return true;
        })
        .sort((a, b) => (a.order || 999) - (b.order || 999));
}

const getTutorials = async (req, res) => {
    try {
        const ctx = await resolveUserRoleContext(req);
        const includeAll = req.query.includeAll === 'true' || ctx.isAdminViewer;
        const tutorials = filterTutorialsForUser(TUTORIALS_CATALOG, ctx, {
            category: req.query.category,
            role: req.query.role,
            includeAll
        });

        res.json({
            success: true,
            userRole: ctx.roleName,
            isAdminViewer: ctx.isAdminViewer,
            categories: TUTORIAL_CATEGORIES,
            roleGuides: ROLE_GUIDES,
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
        const allowed = filterTutorialsForUser([tutorial], ctx, { includeAll: ctx.isAdminViewer });
        if (allowed.length === 0) {
            return res.status(403).json({ success: false, message: 'Su rol actual no tiene acceso a este tutorial' });
        }

        const company = await reportPdfHelper.getCompanyInfo(req.company_id);
        const pdfBuffer = await tutorialPdfService.generateTutorialPdfBuffer(tutorial, company);
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
        const { category = 'all', role = 'all', includeAll = 'false' } = req.query;
        const ctx = await resolveUserRoleContext(req);
        const tutorials = filterTutorialsForUser(TUTORIALS_CATALOG, ctx, {
            category,
            role,
            includeAll: includeAll === 'true' || ctx.isAdminViewer
        });

        if (tutorials.length === 0) {
            return res.status(404).json({ success: false, message: 'No hay tutoriales disponibles para exportar con ese filtro' });
        }

        const company = await reportPdfHelper.getCompanyInfo(req.company_id);
        const titleParts = ['MANUAL OPERATIVO DE USUARIO'];
        if (category && category !== 'all') {
            const cat = TUTORIAL_CATEGORIES.find(c => c.id === category);
            if (cat) titleParts.push(cat.label.toUpperCase());
        }
        const subtitle = role && role !== 'all'
            ? `ROL: ${role.toUpperCase()}`
            : `ROL ACTIVO: ${ctx.roleName.toUpperCase()} (${tutorials.length} GUÍAS)`;

        const pdfBuffer = await tutorialPdfService.generateTutorialPackPdfBuffer(
            tutorials,
            titleParts.join(' — '),
            subtitle,
            company
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Manual_Operativo_Tienda_y_Pista.pdf"');
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
