const rhBiometricConfigService = require('../../services/rhBiometricConfig.service');

const getSettings = async (req, res) => {
    try {
        const settings = await rhBiometricConfigService.getSettings(req.company_id);
        res.json({ success: true, data: settings });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const updateSettings = async (req, res) => {
    try {
        const settings = await rhBiometricConfigService.updateSettings(req.company_id, req.body);
        res.json({ success: true, data: settings, message: 'Configuración guardada exitosamente.' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// Turnos / Horarios
const getShifts = async (req, res) => {
    try {
        const shifts = await rhBiometricConfigService.getShifts(req.company_id);
        res.json({ success: true, data: shifts });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const saveShift = async (req, res) => {
    try {
        const shift = await rhBiometricConfigService.saveShift(req.company_id, req.body);
        res.json({ success: true, data: shift, message: 'Turno guardado exitosamente.' });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message });
    }
};

const deleteShift = async (req, res) => {
    try {
        await rhBiometricConfigService.deleteShift(req.company_id, req.params.id);
        res.json({ success: true, message: 'Turno eliminado.' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const getEmployeeShifts = async (req, res) => {
    try {
        const employees = await rhBiometricConfigService.getEmployeeShiftAssignments(req.company_id);
        res.json({ success: true, data: employees });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const assignEmployeeShift = async (req, res) => {
    try {
        const { turnoId } = req.body;
        await rhBiometricConfigService.assignEmployeeShift(req.company_id, req.params.employeeId, turnoId);
        res.json({ success: true, message: 'Turno asignado al colaborador.' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// Festivos
const getHolidays = async (req, res) => {
    try {
        const holidays = await rhBiometricConfigService.getHolidays(req.company_id, req.query.pais || 'SV');
        res.json({ success: true, data: holidays });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const saveHoliday = async (req, res) => {
    try {
        const holiday = await rhBiometricConfigService.saveHoliday(req.company_id, req.body);
        res.json({ success: true, data: holiday, message: 'Día festivo guardado.' });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message });
    }
};

const deleteHoliday = async (req, res) => {
    try {
        await rhBiometricConfigService.deleteHoliday(req.company_id, req.params.id);
        res.json({ success: true, message: 'Día festivo eliminado.' });
    } catch (e) {
        res.status(e.status || 500).json({ message: e.message });
    }
};

const toggleHoliday = async (req, res) => {
    try {
        await rhBiometricConfigService.toggleHoliday(req.params.id, req.body.is_active);
        res.json({ success: true, message: 'Estado del festivo actualizado.' });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

// Horas Extras
const getOvertimeEmployees = async (req, res) => {
    try {
        const employees = await rhBiometricConfigService.getOvertimeEmployees(req.company_id);
        res.json({ success: true, data: employees });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const updateEmployeeOvertimeExemption = async (req, res) => {
    try {
        const result = await rhBiometricConfigService.updateEmployeeOvertimeExemption(req.company_id, req.params.employeeId, req.body.exento);
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const batchUpdateOvertimeExemptions = async (req, res) => {
    try {
        const result = await rhBiometricConfigService.batchUpdateOvertimeExemptions(req.company_id, req.body);
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const reclassifyPunches = async (req, res) => {
    try {
        const result = await rhBiometricConfigService.reclassifyPunches(req.company_id, req.body.startDate, req.body.endDate);
        res.json(result);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    getShifts,
    saveShift,
    deleteShift,
    getEmployeeShifts,
    assignEmployeeShift,
    getHolidays,
    saveHoliday,
    deleteHoliday,
    toggleHoliday,
    getOvertimeEmployees,
    updateEmployeeOvertimeExemption,
    batchUpdateOvertimeExemptions,
    reclassifyPunches
};
