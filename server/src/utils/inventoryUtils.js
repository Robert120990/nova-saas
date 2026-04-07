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

module.exports = { getEffectiveProductId };
