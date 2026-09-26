/**
 * Resolves the effective product ID for inventory movements.
 * If the product has a discount_from_id configured, it returns that ID.
 * This allows one product to 'point' to another for stock control.
 * 
 * @param {Object} connection - Database connection/pool
 * @param {number} productId - The original product ID
 * @returns {Promise<number>} - The effective product ID for stock updates
 */
async function getEffectiveProductId(connection, productId) {
    if (!productId) return null;
    
    try {
        const [rows] = await connection.query(
            'SELECT discount_from_id FROM products WHERE id = ?',
            [productId]
        );
        
        if (rows.length > 0 && rows[0].discount_from_id) {
            return rows[0].discount_from_id;
        }
        
        return productId;
    } catch (error) {
        console.error('Error resolving effective product ID:', error);
        return productId; // Fallback to original
    }
}

/**
 * Gets the set of category IDs configured as lubricants for a company and branch.
 * Checks gas_station_settings for setting_key = 'lubricant_category_id'.
 *
 * @param {Object} connection - Database connection/pool
 * @param {number} companyId - Company ID
 * @param {number|null} branchId - Branch ID
 * @returns {Promise<Set<number>>} - Set of lubricant category IDs
 */
async function getLubricantCategoryIds(connection, companyId, branchId = null) {
    if (!companyId) return new Set();
    try {
        let query = `
            SELECT DISTINCT setting_value 
            FROM gas_station_settings 
            WHERE company_id = ? AND setting_key = 'lubricant_category_id' 
              AND setting_value IS NOT NULL AND setting_value != ''
        `;
        const params = [companyId];
        if (branchId) {
            query += ` AND (branch_id = ? OR branch_id IS NULL)`;
            params.push(branchId);
        }
        const [rows] = await connection.query(query, params);
        return new Set(rows.map(r => parseInt(r.setting_value, 10)).filter(Boolean));
    } catch (error) {
        console.error('Error in getLubricantCategoryIds:', error.message);
        return new Set();
    }
}

/**
 * Checks if a product belongs to the category configured as lubricants.
 *
 * @param {Object} connection - Database connection/pool
 * @param {number} companyId - Company ID
 * @param {number|null} branchId - Branch ID
 * @param {number} productId - Product ID
 * @param {Set<number>|null} preloadedCategoryIds - Optional preloaded Set of category IDs
 * @returns {Promise<boolean>} - True if product is in lubricant category
 */
async function isLubricantProduct(connection, companyId, branchId, productId, preloadedCategoryIds = null) {
    if (!productId || !companyId) return false;
    try {
        const catIds = preloadedCategoryIds || await getLubricantCategoryIds(connection, companyId, branchId);
        if (catIds.size === 0) return false;

        const [rows] = await connection.query(
            'SELECT category_id FROM products WHERE id = ?',
            [productId]
        );
        if (rows.length === 0 || !rows[0].category_id) return false;
        return catIds.has(parseInt(rows[0].category_id, 10));
    } catch (error) {
        console.error('Error in isLubricantProduct:', error.message);
        return false;
    }
}

module.exports = {
    getEffectiveProductId,
    getLubricantCategoryIds,
    isLubricantProduct
};
