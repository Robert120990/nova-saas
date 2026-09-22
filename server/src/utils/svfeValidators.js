/**
 * Validaciones oficiales de documentos y datos tributarios SVFE (Ministerio de Hacienda)
 */

function validateDocumentNumber(doc, type = null) {
    if (doc === null || doc === undefined) {
        return { isValid: false, error: 'Documento no proporcionado' };
    }

    const raw = String(doc).trim();
    if (!raw) {
        return { isValid: false, error: 'El número de documento no puede estar vacío' };
    }

    const clean = raw.replace(/[-\s]/g, '');

    // 1. Detección de ceros totales (ej. '000000000', '00000000000000', '000')
    if (/^0+$/.test(clean)) {
        return { isValid: false, error: 'El documento no puede ser todo ceros (número ficticio)' };
    }

    // 2. Detección de todos los dígitos iguales (ej. '111111111', '999999999')
    if (/^(\d)\1+$/.test(clean)) {
        return { isValid: false, error: 'El documento no puede tener todos los dígitos repetidos' };
    }

    const upperType = type ? String(type).toUpperCase() : null;

    // 3. Documentos Salvadoreños (DUI o NIT)
    if (!upperType || upperType === 'DUI' || upperType === 'NIT' || upperType === '13' || upperType === '36') {
        const digits = clean.replace(/\D/g, '');

        if (upperType === 'DUI' || upperType === '13') {
            if (digits.length !== 9) {
                return { isValid: false, error: 'El DUI debe tener exactamente 9 dígitos (ej. 00000000-0)' };
            }
        } else if (upperType === 'NIT' || upperType === '36') {
            if (digits.length !== 9 && digits.length !== 14) {
                return { isValid: false, error: 'El NIT debe tener 9 dígitos (DUI homologado) o 14 dígitos (NIT tradicional)' };
            }
        } else {
            if (digits.length !== 9 && digits.length !== 14) {
                return { isValid: false, error: 'El documento debe tener 9 dígitos (DUI) o 14 dígitos (NIT)' };
            }
        }

        // Regla oficial de Hacienda: No puede comenzar con 7 o más ceros consecutivos
        if (/^0{7}/.test(digits)) {
            return { isValid: false, error: 'El documento no puede iniciar con ceros consecutivos ficticios' };
        }

        return { isValid: true };
    }

    // 4. Documentos Extranjeros (Pasaporte, Carnet Residente, Otro)
    if (upperType === 'PASAPORTE' || upperType === '03' ||
        upperType === 'CARNET RESIDENTE' || upperType === 'CARNET RESIDENT' || upperType === '02' ||
        upperType === 'OTRO' || upperType === '37') {
        if (clean.length < 3 || clean.length > 20) {
            return { isValid: false, error: 'El documento extranjero debe tener entre 3 y 20 caracteres' };
        }
        return { isValid: true };
    }

    if (clean.length < 3) {
        return { isValid: false, error: 'Documento no válido' };
    }

    return { isValid: true };
}

function isValidDocumentNumber(doc, type = null) {
    return validateDocumentNumber(doc, type).isValid;
}

module.exports = {
    validateDocumentNumber,
    isValidDocumentNumber
};
