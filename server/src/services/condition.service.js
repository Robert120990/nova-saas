const { resolvePath } = require('./template.service');

function evaluate(condition, context) {
    const { field, operator, value } = condition;
    const actualValue = resolvePath(context, field);

    if (actualValue === null || actualValue === undefined) {
        return false;
    }

    const strActual = String(actualValue).toLowerCase().trim();
    const strValue = String(value).toLowerCase().trim();

    switch (operator) {
        case 'eq':
            return strActual === strValue;
        case 'neq':
            return strActual !== strValue;
        case 'gt':
            return parseFloat(actualValue) > parseFloat(value);
        case 'gte':
            return parseFloat(actualValue) >= parseFloat(value);
        case 'lt':
            return parseFloat(actualValue) < parseFloat(value);
        case 'lte':
            return parseFloat(actualValue) <= parseFloat(value);
        case 'contains':
            return strActual.includes(strValue);
        default:
            return false;
    }
}

function evaluateAll(conditions, context) {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(c => evaluate(c, context));
}

module.exports = { evaluate, evaluateAll };
