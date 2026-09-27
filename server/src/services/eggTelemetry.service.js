// Estado de demostración aislado por empresa. No controla dispositivos físicos.
const states = new Map();
function initialState() {
    return { is_simulation: true, tanks: [
        { id: 'Tanque Pulmón 1', temp: 3.8, humidity: 45.2, status: 'normal' },
        { id: 'Tanque Pulmón 2', temp: 4.1, humidity: 48, status: 'normal' }
    ], pasteurizer: { temp: 22, flow: 0, pressure: 0, holdingTime: 0, haccpStatus: 'unknown', active: false, batchUuid: null } };
}
function stateFor(companyId) {
    if (!states.has(companyId)) states.set(companyId, initialState());
    return states.get(companyId);
}
function command(companyId, event, data = {}) {
    const state = stateFor(companyId);
    if (event === 'control_pasteurizer') { state.pasteurizer.active = data.active === true; state.pasteurizer.batchUuid = data.batchUuid || null; }
    else if (event === 'inject_haccp_deviation' && Number.isFinite(Number(data.temperature))) {
        state.pasteurizer.temp = Number(data.temperature); state.pasteurizer.haccpStatus = 'deviation';
    } else if (event === 'inject_tank_alarm' && Number.isFinite(Number(data.temp))) {
        const tank = state.tanks.find(t => t.id === data.tankId);
        if (tank) { tank.temp = Number(data.temp); tank.status = 'alarm'; }
    } else if (event === 'reset_alarms') states.set(companyId, initialState());
    return stateFor(companyId);
}
module.exports = { stateFor, command };
