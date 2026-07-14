const pool = require('../config/db');

const getMenuItems = async (req, res) => {
    try {
        const { active_only } = req.query;
        let query = 'SELECT * FROM menu_items';
        const params = [];
        if (active_only === 'true') {
            query += ' WHERE is_active = TRUE';
        }
        query += ' ORDER BY sort_order ASC';
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al obtener items del menú:', error);
        res.status(500).json({ message: 'Error al obtener items del menú' });
    }
};

const getPermissions = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT m.id, m.label, m.icon, m.permission_key, m.extra_permissions,
                   p.label as parent_label, p.id as parent_id
            FROM menu_items m
            LEFT JOIN menu_items p ON m.parent_id = p.id
            WHERE m.permission_key IS NOT NULL
            ORDER BY p.sort_order ASC, m.sort_order ASC
        `);

        const groups = {};
        const seen = {};

        rows.forEach(item => {
            const parentLabel = item.parent_label || 'Generales';
            if (!groups[parentLabel]) {
                groups[parentLabel] = {
                    id: parentLabel.toLowerCase().replace(/\s+/g, '-'),
                    label: parentLabel,
                    icon: item.parent_id ? null : item.icon,
                    permissions: []
                };
            }

            if (item.permission_key && !seen[item.permission_key]) {
                seen[item.permission_key] = true;
                groups[parentLabel].permissions.push({
                    id: item.permission_key,
                    label: item.label
                });
            }

            if (item.extra_permissions) {
                let extras = item.extra_permissions;
                if (typeof extras === 'string') {
                    try { extras = JSON.parse(extras); } catch (e) { extras = []; }
                }
                if (Array.isArray(extras)) {
                    extras.forEach(perm => {
                        if (!seen[perm]) {
                            seen[perm] = true;
                            groups[parentLabel].permissions.push({
                                id: perm,
                                label: `${item.label} (${perm})`
                            });
                        }
                    });
                }
            }
        });

        res.json(Object.values(groups));
    } catch (error) {
        console.error('Error al obtener permisos:', error);
        res.status(500).json({ message: 'Error al obtener permisos' });
    }
};

const createMenuItem = async (req, res) => {
    const { label, path, icon, parent_id, permission_key, extra_permissions, sort_order, is_active, hide_in_menu } = req.body;
    try {
        let permKey = permission_key;
        if (!permKey && label) {
            permKey = label
                .toLowerCase()
                .replace(/[^a-z0-9áéíóúñü\s]/g, '')
                .replace(/[áéíóúñü]/g, c => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' })[c] || c)
                .replace(/\s+/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
        }

        const [result] = await pool.query(
            `INSERT INTO menu_items (label, path, icon, parent_id, permission_key, extra_permissions, sort_order, is_active, hide_in_menu) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [label, path || null, icon || null, parent_id || null, permKey, extra_permissions ? JSON.stringify(extra_permissions) : null, sort_order || 0, is_active !== false, hide_in_menu || false]
        );

        const [inserted] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [result.insertId]);
        res.status(201).json(inserted[0]);
    } catch (error) {
        console.error('Error al crear item del menú:', error);
        res.status(500).json({ message: 'Error al crear item del menú' });
    }
};

const updateMenuItem = async (req, res) => {
    const { id } = req.params;
    const { label, path, icon, parent_id, permission_key, extra_permissions, sort_order, is_active, hide_in_menu } = req.body;
    try {
        await pool.query(
            `UPDATE menu_items SET label = ?, path = ?, icon = ?, parent_id = ?, permission_key = ?, extra_permissions = ?, sort_order = ?, is_active = ?, hide_in_menu = ? WHERE id = ?`,
            [label, path || null, icon || null, parent_id || null, permission_key || null, extra_permissions ? JSON.stringify(extra_permissions) : null, sort_order || 0, is_active !== false, hide_in_menu || false, id]
        );
        const [updated] = await pool.query('SELECT * FROM menu_items WHERE id = ?', [id]);
        res.json(updated[0]);
    } catch (error) {
        console.error('Error al actualizar item del menú:', error);
        res.status(500).json({ message: 'Error al actualizar item del menú' });
    }
};

const deleteMenuItem = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
        res.json({ message: 'Item del menú eliminado' });
    } catch (error) {
        console.error('Error al eliminar item del menú:', error);
        res.status(500).json({ message: 'Error al eliminar item del menú' });
    }
};

const reorderMenuItems = async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ message: 'Formato inválido' });
    }
    try {
        for (const item of items) {
            await pool.query(
                'UPDATE menu_items SET sort_order = ?, parent_id = ? WHERE id = ?',
                [item.sort_order, item.parent_id || null, item.id]
            );
        }
        res.json({ message: 'Orden actualizado' });
    } catch (error) {
        console.error('Error al reordenar items:', error);
        res.status(500).json({ message: 'Error al reordenar items' });
    }
};

module.exports = { getMenuItems, getPermissions, createMenuItem, updateMenuItem, deleteMenuItem, reorderMenuItems };
