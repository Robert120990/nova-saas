const { pool } = require('./shared');

const getVehicles = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { estado, activo } = req.query;

        let sql = `
            SELECT v.*,
                   (SELECT COUNT(*)
                    FROM vehicle_maintenance_logs m
                    WHERE m.vehicle_id = v.id AND m.estado = 'programado') AS mantenimientos_pendientes,
                   (SELECT COUNT(*)
                    FROM egg_dispatch_routes r
                    WHERE r.vehicle_id = v.id AND r.estado = 'en_curso') AS rutas_activas
            FROM delivery_vehicles v
            WHERE v.company_id = ?
        `;
        const params = [company_id];

        if (activo !== undefined && activo !== '') {
            sql += ' AND v.is_active = ?';
            params.push(activo === 'true' || activo === '1' ? 1 : 0);
        } else {
            sql += ' AND v.is_active = 1';
        }

        if (estado) {
            sql += ' AND v.estado = ?';
            params.push(estado);
        }

        sql += ' ORDER BY v.codigo ASC, v.placa ASC';

        const [vehicles] = await pool.query(sql, params);
        res.json(vehicles);
    } catch (error) {
        console.error('Error al obtener vehículos:', error);
        res.status(500).json({ message: error.message });
    }
};

const saveVehicle = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { id } = req.params;
        const {
            codigo,
            placa,
            marca,
            modelo,
            anio,
            tipo_vehiculo,
            capacidad_peso_lbs,
            capacidad_cubetas,
            tiene_termo_king,
            odometro_actual,
            estado,
            ultimo_mantenimiento_fecha,
            ultimo_mantenimiento_km,
            proximo_mantenimiento_fecha,
            proximo_mantenimiento_km,
            notas,
            is_active
        } = req.body;

        if (!codigo || !placa) {
            return res.status(400).json({ message: 'El código del vehículo y la placa son obligatorios.' });
        }

        // Validar placa única dentro de la empresa
        let checkSql = 'SELECT id FROM delivery_vehicles WHERE company_id = ? AND placa = ?';
        const checkParams = [company_id, placa.trim()];
        if (id) {
            checkSql += ' AND id != ?';
            checkParams.push(id);
        }
        const [dup] = await pool.query(checkSql, checkParams);
        if (dup.length > 0) {
            return res.status(400).json({ message: `Ya existe un vehículo registrado con la placa ${placa}.` });
        }

        if (id) {
            await pool.query(
                `UPDATE delivery_vehicles SET
                    codigo = ?, placa = ?, marca = ?, modelo = ?, anio = ?,
                    tipo_vehiculo = ?, capacidad_peso_lbs = ?, capacidad_cubetas = ?,
                    tiene_termo_king = ?, odometro_actual = ?, estado = ?,
                    ultimo_mantenimiento_fecha = ?, ultimo_mantenimiento_km = ?,
                    proximo_mantenimiento_fecha = ?, proximo_mantenimiento_km = ?,
                    notas = ?, is_active = ?
                 WHERE id = ? AND company_id = ?`,
                [
                    codigo.trim().toUpperCase(),
                    placa.trim().toUpperCase(),
                    marca || null,
                    modelo || null,
                    parseInt(anio) || null,
                    tipo_vehiculo || 'camion_refrigerado',
                    parseFloat(capacidad_peso_lbs) || 10000.0,
                    parseInt(capacidad_cubetas) || 350,
                    tiene_termo_king ? 1 : 0,
                    parseFloat(odometro_actual) || 0,
                    estado || 'disponible',
                    ultimo_mantenimiento_fecha || null,
                    ultimo_mantenimiento_km ? parseFloat(ultimo_mantenimiento_km) : null,
                    proximo_mantenimiento_fecha || null,
                    proximo_mantenimiento_km ? parseFloat(proximo_mantenimiento_km) : null,
                    notas || null,
                    is_active !== undefined ? (is_active ? 1 : 0) : 1,
                    id,
                    company_id
                ]
            );
            res.json({ id, message: 'Vehículo actualizado exitosamente.' });
        } else {
            const [result] = await pool.query(
                `INSERT INTO delivery_vehicles (
                    company_id, codigo, placa, marca, modelo, anio, tipo_vehiculo,
                    capacidad_peso_lbs, capacidad_cubetas, tiene_termo_king, odometro_actual,
                    estado, ultimo_mantenimiento_fecha, ultimo_mantenimiento_km,
                    proximo_mantenimiento_fecha, proximo_mantenimiento_km, notas, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id,
                    codigo.trim().toUpperCase(),
                    placa.trim().toUpperCase(),
                    marca || null,
                    modelo || null,
                    parseInt(anio) || null,
                    tipo_vehiculo || 'camion_refrigerado',
                    parseFloat(capacidad_peso_lbs) || 10000.0,
                    parseInt(capacidad_cubetas) || 350,
                    tiene_termo_king ? 1 : 0,
                    parseFloat(odometro_actual) || 0,
                    estado || 'disponible',
                    ultimo_mantenimiento_fecha || null,
                    ultimo_mantenimiento_km ? parseFloat(ultimo_mantenimiento_km) : null,
                    proximo_mantenimiento_fecha || null,
                    proximo_mantenimiento_km ? parseFloat(proximo_mantenimiento_km) : null,
                    notas || null,
                    is_active !== undefined ? (is_active ? 1 : 0) : 1
                ]
            );
            res.status(201).json({ id: result.insertId, message: 'Vehículo registrado exitosamente.' });
        }
    } catch (error) {
        console.error('Error al guardar vehículo:', error);
        res.status(500).json({ message: error.message });
    }
};

const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.company_id || req.user?.company_id;

        // Desactivación lógica segura
        await pool.query(
            'UPDATE delivery_vehicles SET is_active = 0, estado = "inactivo" WHERE id = ? AND company_id = ?',
            [id, company_id]
        );
        res.json({ message: 'Vehículo inactivado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        res.status(500).json({ message: error.message });
    }
};

const getMaintenanceLogs = async (req, res) => {
    try {
        const company_id = req.company_id || req.user?.company_id;
        const { vehicle_id, estado, fecha_desde, fecha_hasta } = req.query;

        let sql = `
            SELECT m.*,
                   v.codigo AS vehicle_codigo,
                   v.placa AS vehicle_placa,
                   v.marca AS vehicle_marca,
                   v.modelo AS vehicle_modelo,
                   v.odometro_actual AS vehicle_odometro_actual,
                   u.nombre AS responsable_nombre
            FROM vehicle_maintenance_logs m
            JOIN delivery_vehicles v ON m.vehicle_id = v.id
            LEFT JOIN users u ON m.responsable_usuario_id = u.id
            WHERE m.company_id = ?
        `;
        const params = [company_id];

        if (vehicle_id) {
            sql += ' AND m.vehicle_id = ?';
            params.push(vehicle_id);
        }

        if (estado) {
            sql += ' AND m.estado = ?';
            params.push(estado);
        }

        if (fecha_desde) {
            sql += ' AND m.fecha_programada >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            sql += ' AND m.fecha_programada <= ?';
            params.push(fecha_hasta);
        }

        sql += ' ORDER BY m.fecha_programada DESC, m.id DESC';

        const [logs] = await pool.query(sql, params);
        res.json(logs);
    } catch (error) {
        console.error('Error al obtener mantenimientos:', error);
        res.status(500).json({ message: error.message });
    }
};
module.exports = { getVehicles, saveVehicle, deleteVehicle, getMaintenanceLogs };
