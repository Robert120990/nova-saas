/**
 * Evaluador matemático seguro para CommandPalette (Ctrl+K).
 * - Soporta: +, -, *, /, x, X, ×, ÷, %, paréntesis () y decimales (. o ,).
 * - Tolera espacios arbitrarios: '15*8', '15 * 8', '15* 8', '15 *8'.
 * - Tolera prefijo o sufijo '=': '=278+177+75' o '278+177+75='.
 * - Calcula porcentajes comerciales directamente en el árbol sintáctico:
 *     100 + 13%        => 113  (recargo / IVA)
 *     100 - 15%        => 85   (descuento)
 *     (200+300) + 13%  => 565  (porcentaje sobre subtotal)
 *     500 * 10%        => 50   (comisión / proporción)
 *     100 / 50%        => 200
 *     15%              => 0.15
 * - 100% seguro: Analizador por descenso recursivo puro (cero eval, cero Function).
 *   Inmune a inyección de código, XSS y manipulación de rutas/pantallas.
 */

export function evaluateSafeMath(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return null;
    let str = rawInput.trim();
    const hadEqualSign = str.startsWith('=') || str.endsWith('=');
    if (str.startsWith('=')) str = str.slice(1).trim();
    if (str.endsWith('=')) str = str.slice(0, -1).trim();
    if (!str || !/\d/.test(str)) return null;

    // Whitelist estricta: solo dígitos, espacios, puntos/comas decimales y operadores válidos
    if (!/^[0-9\s.,+*xX×÷/%()-]+$/.test(str)) return null;

    // Debe contener al menos un operador/paréntesis o haber incluido '='
    if (!/[+*xX×÷/%()-]/.test(str) && !hadEqualSign) return null;

    // Si termina en un operador binario incompleto (ej: '15 +') o '(' incompleto, esperar al siguiente número
    if (/[+*xX×÷/-]\s*$/.test(str) || /\(\s*$/.test(str)) return null;

    // Normalizar operadores de multiplicación y división
    str = str.replace(/[xX×]/g, '*').replace(/÷/g, '/');

    // Manejo inteligente de comas y puntos:
    // Si contiene tanto ',' como '.', las comas son separadores de miles (ej: 1,250.50)
    if (str.includes(',') && str.includes('.')) {
        str = str.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1');
        if (str.includes(',')) return null;
    } else if (/(\d),(?=\d{3},)/.test(str)) {
        // Múltiples comas de miles (ej: 1,000,000)
        str = str.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1');
    } else {
        // Coma usada como separador decimal (ej: 15,5 + 4,5 -> 15.5 + 4.5)
        str = str.replace(/(\d+),(\d+)/g, '$1.$2');
    }

    // Tokenizar la expresión
    const rawTokens = [];
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (/\s/.test(ch)) {
            i++;
            continue;
        }
        if (/[0-9.]/.test(ch)) {
            let numStr = '';
            let dotCount = 0;
            while (i < str.length && /[0-9.]/.test(str[i])) {
                if (str[i] === '.') dotCount++;
                if (dotCount > 1) return null;
                numStr += str[i];
                i++;
            }
            if (numStr === '.' || numStr.endsWith('.')) return null;
            const num = Number(numStr);
            if (!Number.isFinite(num)) return null;
            rawTokens.push({ type: 'number', value: num });
            continue;
        }
        if ('+-*/%()'.includes(ch)) {
            rawTokens.push({ type: 'operator', value: ch });
            i++;
            continue;
        }
        return null;
    }

    if (rawTokens.length === 0) return null;

    // Insertar multiplicación implícita: ej. 2(5+3) => 2*(5+3), (2)(3) => (2)*(3)
    const tokens = [];
    for (let idx = 0; idx < rawTokens.length; idx++) {
        const curr = rawTokens[idx];
        const prev = tokens[tokens.length - 1];
        if (prev) {
            const prevIsValueEnd =
                prev.type === 'number' ||
                prev.value === ')' ||
                prev.value === '%';
            const currIsParenStart = curr.value === '(';
            const prevIsCloseOrPct = prev.value === ')' || prev.value === '%';
            const currIsNumber = curr.type === 'number';

            if ((prevIsValueEnd && currIsParenStart) || (prevIsCloseOrPct && currIsNumber)) {
                tokens.push({ type: 'operator', value: '*' });
            }
        }
        tokens.push(curr);
    }

    // Verificar que exista una operación real (al menos 2 números, un '%' o '=')
    const numberCount = tokens.filter(t => t.type === 'number').length;
    const hasPercent = tokens.some(t => t.value === '%');
    if (!hadEqualSign && numberCount < 2 && !hasPercent) return null;

    let pos = 0;
    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];

    const parseFactor = () => {
        if (!peek()) return null;
        if (peek().value === '+') {
            consume();
            return parseFactor();
        }
        if (peek().value === '-') {
            consume();
            const factor = parseFactor();
            return factor ? { value: -factor.value, isPercent: factor.isPercent } : null;
        }
        if (peek().value === '(') {
            consume();
            const val = parseExpression();
            if (val === null) return null;
            if (!peek() || peek().value !== ')') return null;
            consume();
            let resultVal = val;
            let isPercent = false;
            while (peek() && peek().value === '%') {
                consume();
                resultVal = resultVal / 100;
                isPercent = true;
            }
            return { value: resultVal, isPercent };
        }
        if (peek().type === 'number') {
            let val = consume().value;
            let isPercent = false;
            while (peek() && peek().value === '%') {
                consume();
                val = val / 100;
                isPercent = true;
            }
            return { value: val, isPercent };
        }
        return null;
    };

    const parseTerm = () => {
        let left = parseFactor();
        if (!left) return null;
        while (peek() && (peek().value === '*' || peek().value === '/')) {
            const op = consume().value;
            const right = parseFactor();
            if (!right) return null;
            if (op === '/') {
                if (right.value === 0) return null;
                left = { value: left.value / right.value, isPercent: false };
            } else {
                left = { value: left.value * right.value, isPercent: false };
            }
        }
        return left;
    };

    const parseExpression = () => {
        const first = parseTerm();
        if (!first) return null;
        let total = first.value;
        let leftAllPercent = first.isPercent;

        while (peek() && (peek().value === '+' || peek().value === '-')) {
            const op = consume().value;
            const right = parseTerm();
            if (!right) return null;

            if (right.isPercent && !leftAllPercent) {
                const delta = total * right.value;
                total = op === '+' ? total + delta : total - delta;
            } else {
                total = op === '+' ? total + right.value : total - right.value;
                if (!right.isPercent) leftAllPercent = false;
            }
        }
        return total;
    };

    const result = parseExpression();
    if (result === null || pos !== tokens.length) return null;
    if (!Number.isFinite(result) || Number.isNaN(result)) return null;

    // Redondear a máximo 6 decimales sin ceros superfluos
    return Math.round(result * 1000000) / 1000000;
}

/**
 * Copia texto al portapapeles con soporte tanto para HTTPS/localhost (Clipboard API)
 * como para entornos HTTP en red local (fallback con textarea invisible).
 */
export async function copyTextToClipboard(text) {
    const str = String(text ?? '');
    if (!str) return false;

    if (navigator?.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(str);
            return true;
        } catch {
            // Continuar con fallback si falla en contexto no seguro (HTTP LAN)
        }
    }

    try {
        const textarea = document.createElement('textarea');
        textarea.value = str;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        return copied;
    } catch {
        return false;
    }
}
