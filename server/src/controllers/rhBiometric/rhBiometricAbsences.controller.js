const rhBiometricAbsencesService = require('../../services/rhBiometricAbsences.service');

const getAbsenceCatalog = async (_req, res) => {
    try {
        res.json({ success: true, data: rhBiometricAbsencesService.ABSENCE_CATALOG });
    } catch (error) {
        res.status(500).json({ message: error.message || 'Error al obtener catálogo de ausencias.' });
    }
};

const getDailyAttendanceRadar = async (req, res) => {
    try {
        const result = await rhBiometricAbsencesService.getDailyAttendanceRadar(req.company_id, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error al consultar radar diario de asistencia:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al consultar radar diario de asistencia.' });
    }
};

const getBiometricAbsences = async (req, res) => {
    try {
        const result = await rhBiometricAbsencesService.getAbsencesList(req.company_id, req.query);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error al listar permisos e inasistencias:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al listar permisos e inasistencias.' });
    }
};

const createBiometricAbsence = async (req, res) => {
    try {
        const result = await rhBiometricAbsencesService.saveAbsence(req.company_id, req.user?.id, req.body);
        res.status(201).json({
            success: true,
            data: result,
            message: 'Registro de permiso / inasistencia guardado correctamente.'
        });
    } catch (error) {
        console.error('Error al crear permiso o inasistencia:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al registrar permiso o inasistencia.' });
    }
};

const updateBiometricAbsence = async (req, res) => {
    try {
        const result = await rhBiometricAbsencesService.saveAbsence(req.company_id, req.user?.id, {
            ...req.body,
            id: req.params.id
        });
        res.json({
            success: true,
            data: result,
            message: 'Registro de permiso / inasistencia actualizado correctamente.'
        });
    } catch (error) {
        console.error('Error al actualizar permiso o inasistencia:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al actualizar permiso o inasistencia.' });
    }
};

const authorizeBiometricAbsence = async (req, res) => {
    try {
        const result = await rhBiometricAbsencesService.authorizeAbsence(
            req.company_id,
            req.user?.id,
            req.params.id,
            req.body
        );
        const label = result.estado_autorizacion === 'autorizado'
            ? 'Permiso autorizado correctamente.'
            : result.estado_autorizacion === 'rechazado'
                ? 'Permiso marcado como no autorizado.'
                : 'Permiso devuelto a revisión pendiente.';
        res.json({ success: true, data: result, message: label });
    } catch (error) {
        console.error('Error al resolver autorización de permiso:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al actualizar estado de autorización.' });
    }
};

const deleteBiometricAbsence = async (req, res) => {
    try {
        await rhBiometricAbsencesService.deleteAbsence(req.company_id, req.params.id);
        res.json({ success: true, message: 'Registro eliminado correctamente.' });
    } catch (error) {
        console.error('Error al eliminar permiso o inasistencia:', error);
        res.status(error.status || 500).json({ message: error.message || 'Error al eliminar el registro.' });
    }
};

module.exports = {
    getAbsenceCatalog,
    getDailyAttendanceRadar,
    getBiometricAbsences,
    createBiometricAbsence,
    updateBiometricAbsence,
    authorizeBiometricAbsence,
    deleteBiometricAbsence
};
