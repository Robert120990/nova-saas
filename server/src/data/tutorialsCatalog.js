/**
 * Fachada unificada del Catálogo Oficial de Tutoriales Operativos de SIPE-WEB
 * (Fases 1 y 2 — Cobertura total de módulos, 9 categorías y 15 roles)
 */

const { TUTORIAL_CATEGORIES, ROLE_GUIDES } = require('./tutorials/categoriesAndRoles');
const TIENDA_PISTA_TUTORIALS = require('./tutorials/tiendaPistaTutorials');
const COMPRAS_INVENTARIO_TUTORIALS = require('./tutorials/comprasInventarioTutorials');
const FINANZAS_CONTABILIDAD_TUTORIALS = require('./tutorials/finanzasContabilidadTutorials');
const RRHH_POZO_ADMIN_TUTORIALS = require('./tutorials/rrhhPozoAdminTutorials');
const INDUSTRIAL_CRM_TUTORIALS = require('./tutorials/industrialCrmTutorials');
const INDUSTRIAL_AVANZADO_TUTORIALS = require('./tutorials/industrialAvanzadoTutorials');
const CONTABILIDAD_AVANZADA_TUTORIALS = require('./tutorials/contabilidadAvanzadaTutorials');

const TUTORIALS_CATALOG = [
    ...TIENDA_PISTA_TUTORIALS,
    ...COMPRAS_INVENTARIO_TUTORIALS,
    ...FINANZAS_CONTABILIDAD_TUTORIALS,
    ...RRHH_POZO_ADMIN_TUTORIALS,
    ...INDUSTRIAL_CRM_TUTORIALS,
    ...INDUSTRIAL_AVANZADO_TUTORIALS,
    ...CONTABILIDAD_AVANZADA_TUTORIALS
].sort((a, b) => (a.order || 999) - (b.order || 999));

module.exports = {
    TUTORIAL_CATEGORIES,
    ROLE_GUIDES,
    TUTORIALS_CATALOG
};
