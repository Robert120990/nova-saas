const pool = require('../../config/db');

function safeParseArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val !== 'string') return [];
    try {
        const p = JSON.parse(val);
        return Array.isArray(p) ? p : [];
    } catch {
        return [];
    }
}

async function getModifierGroups(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const [groups] = await pool.query(
            "SELECT * FROM restaurant_modifier_groups WHERE company_id = ? ORDER BY id ASC",
            [companyId]
        );

        for (const g of groups) {
            g.applies_to = g.applies_to || 'categories';
            g.target_category_ids = safeParseArray(g.target_category_ids);
            g.target_product_ids = safeParseArray(g.target_product_ids);

            const [options] = await pool.query(
                "SELECT * FROM restaurant_modifiers WHERE group_id = ? ORDER BY id ASC",
                [g.id]
            );
            g.options = options;
        }

        res.json({ success: true, data: groups });
    } catch (err) {
        console.error('Error in getModifierGroups:', err);
        res.status(500).json({ success: false, message: 'Error al obtener grupos de modificadores' });
    }
}

async function createModifierGroup(req, res) {
    try {
        const companyId = req.company_id || req.companyId;
        const {
            name,
            is_required = 0,
            min_options = 0,
            max_options = 1,
            applies_to = 'categories',
            target_category_ids = [],
            target_product_ids = [],
            options = []
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'El nombre del grupo es obligatorio' });
        }

        const categoryIdsJson = Array.isArray(target_category_ids) && target_category_ids.length > 0
            ? JSON.stringify(target_category_ids.map(Number))
            : null;

        const productIdsJson = Array.isArray(target_product_ids) && target_product_ids.length > 0
            ? JSON.stringify(target_product_ids.map(Number))
            : null;

        const [result] = await pool.query(
            "INSERT INTO restaurant_modifier_groups (company_id, name, applies_to, target_category_ids, target_product_ids, is_required, min_options, max_options) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [companyId, name.trim(), applies_to, categoryIdsJson, productIdsJson, is_required ? 1 : 0, min_options, max_options]
        );

        const groupId = result.insertId;

        if (Array.isArray(options) && options.length > 0) {
            for (const opt of options) {
                if (opt.name && opt.name.trim()) {
                    await pool.query(
                        "INSERT INTO restaurant_modifiers (group_id, name, extra_price) VALUES (?, ?, ?)",
                        [groupId, opt.name.trim(), opt.extra_price || 0]
                    );
                }
            }
        }

        res.status(201).json({ success: true, message: 'Grupo de modificadores creado con éxito', data: { id: groupId } });
    } catch (err) {
        console.error('Error in createModifierGroup:', err);
        res.status(500).json({ success: false, message: 'Error al crear grupo de modificadores' });
    }
}

async function updateModifierGroup(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;
        const {
            name,
            is_required,
            min_options,
            max_options,
            applies_to,
            target_category_ids,
            target_product_ids,
            options
        } = req.body;

        const categoryIdsJson = target_category_ids !== undefined
            ? (Array.isArray(target_category_ids) && target_category_ids.length > 0 ? JSON.stringify(target_category_ids.map(Number)) : null)
            : undefined;

        const productIdsJson = target_product_ids !== undefined
            ? (Array.isArray(target_product_ids) && target_product_ids.length > 0 ? JSON.stringify(target_product_ids.map(Number)) : null)
            : undefined;

        await pool.query(
            `UPDATE restaurant_modifier_groups SET
                name = COALESCE(?, name),
                applies_to = COALESCE(?, applies_to),
                target_category_ids = ${categoryIdsJson !== undefined ? '?' : 'target_category_ids'},
                target_product_ids = ${productIdsJson !== undefined ? '?' : 'target_product_ids'},
                is_required = COALESCE(?, is_required),
                min_options = COALESCE(?, min_options),
                max_options = COALESCE(?, max_options)
            WHERE id = ? AND company_id = ?`,
            [
                name?.trim(),
                applies_to,
                ...(categoryIdsJson !== undefined ? [categoryIdsJson] : []),
                ...(productIdsJson !== undefined ? [productIdsJson] : []),
                is_required !== undefined ? (is_required ? 1 : 0) : undefined,
                min_options,
                max_options,
                id,
                companyId
            ]
        );

        if (Array.isArray(options)) {
            // Reemplazo limpio de opciones del grupo
            await pool.query("DELETE FROM restaurant_modifiers WHERE group_id = ?", [id]);
            for (const opt of options) {
                if (opt.name && opt.name.trim()) {
                    await pool.query(
                        "INSERT INTO restaurant_modifiers (group_id, name, extra_price) VALUES (?, ?, ?)",
                        [id, opt.name.trim(), opt.extra_price || 0]
                    );
                }
            }
        }

        res.json({ success: true, message: 'Grupo de modificadores actualizado con éxito' });
    } catch (err) {
        console.error('Error in updateModifierGroup:', err);
        res.status(500).json({ success: false, message: 'Error al actualizar grupo de modificadores' });
    }
}

async function deleteModifierGroup(req, res) {
    try {
        const { id } = req.params;
        const companyId = req.company_id || req.companyId;

        await pool.query("DELETE FROM restaurant_modifiers WHERE group_id = ?", [id]);
        await pool.query("DELETE FROM restaurant_modifier_groups WHERE id = ? AND company_id = ?", [id, companyId]);

        res.json({ success: true, message: 'Grupo de modificadores eliminado' });
    } catch (err) {
        console.error('Error in deleteModifierGroup:', err);
        res.status(500).json({ success: false, message: 'Error al eliminar grupo de modificadores' });
    }
}

module.exports = {
    getModifierGroups,
    createModifierGroup,
    updateModifierGroup,
    deleteModifierGroup
};
