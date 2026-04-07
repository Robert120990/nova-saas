const pool = require('../config/db');

// GET /api/users/:id/access  — returns companies & branches assigned to user
const getUserAccess = async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query(
            `SELECT ua.id, ua.company_id, c.razon_social AS company_name,
                    ua.branch_id, b.nombre AS branch_name
             FROM user_access ua
             JOIN companies c ON ua.company_id = c.id
             LEFT JOIN branches b ON ua.branch_id = b.id
             WHERE ua.user_id = ?`,
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener accesos' });
    }
};

// PUT /api/users/:id/access  — replace all access entries for user
// body: { access: [{ company_id, branch_id (null = all branches) }] }
const setUserAccess = async (req, res) => {
    const { id } = req.params;
    const { access = [] } = req.body;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Remove existing access for this user
        await conn.query('DELETE FROM user_access WHERE user_id = ?', [id]);
        // Insert new access entries
        if (access.length > 0) {
            const values = access.map(a => [id, a.company_id, a.branch_id ?? null]);
            await conn.query(
                'INSERT INTO user_access (user_id, company_id, branch_id) VALUES ?',
                [values]
            );
        }
        await conn.commit();
        res.json({ message: 'Accesos actualizados' });
    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: 'Error al guardar accesos' });
    } finally {
        conn.release();
    }
};

module.exports = { getUserAccess, setUserAccess };
