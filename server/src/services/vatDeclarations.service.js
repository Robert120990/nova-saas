const { getAnticipoCuentaData } = require('./vatDeclarations/vatAnticipo.service');
const { getRetencionesEmitidasData, getRetencionesRecibidasData } = require('./vatDeclarations/vatRetenciones.service');
const { getPercepcionesData } = require('./vatDeclarations/vatPercepciones.service');
const { getComprasData } = require('./vatDeclarations/vatCompras.service');

const MONTH_NAMES = [
    '', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const getPeriodText = (month, year) => {
    const mNum = parseInt(month, 10);
    const mName = MONTH_NAMES[mNum] || month;
    return `MES DE ${mName} DE ${year}`;
};

module.exports = {
    getPeriodText,
    getAnticipoCuentaData,
    getRetencionesEmitidasData,
    getRetencionesRecibidasData,
    getPercepcionesData,
    getComprasData
};
