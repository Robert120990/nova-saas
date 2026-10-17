import axios from 'axios';

const MAX_NETWORK_LOGS = 20;
const MAX_CONSOLE_LOGS = 20;

const networkFailures = [];
const consoleErrors = [];
let initialized = false;

const SENSITIVE_KEYS = /password|clave|token|jwt|secret|pin|authorization|cert|private|key|auth|code|screenshot_base64|attachment_base64|dataurl/i;

export function redactSensitiveText(str) {
    if (!str) return '';
    return String(str)
        .replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
        .replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, '[REDACTED]')
        .replace(/\b(?:sk-[a-zA-Z0-9_-]{10,}|AIza[a-zA-Z0-9_-]{15,})\b/g, '[REDACTED]')
        .replace(/("(?:password|clave|token|jwt|secret|pin|authorization|api_key|apikey)"\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
        .replace(/(\b(?:password|clave|token|jwt|secret|pin|authorization)\s*[=:]\s*)([^\s,&"']+)/gi, '$1[REDACTED]');
}

export function sanitizeUrl(rawUrl = '') {
    try {
        let cleaned = String(rawUrl || '');
        if (cleaned.startsWith('http')) {
            const u = new URL(cleaned);
            cleaned = u.pathname + u.search;
        }
        return cleaned
            .replace(/([?&](?:[^=&]*?(?:token|jwt|key|secret|password|auth|code)[^=&]*)=)[^&#]*/gi, '$1[REDACTED]')
            .slice(0, 200);
    } catch {
        return redactSensitiveText(String(rawUrl || '').slice(0, 150));
    }
}

function sanitizePayload(data) {
    if (!data) return null;
    try {
        if (typeof data === 'string' && data.length > 10000) return '[Large Payload]';
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (typeof parsed !== 'object' || parsed === null) return redactSensitiveText(String(parsed).slice(0, 120));
        const summary = {};
        Object.keys(parsed).slice(0, 12).forEach((k) => {
            if (SENSITIVE_KEYS.test(k)) {
                summary[k] = '[REDACTED]';
            } else {
                const val = parsed[k];
                if (Array.isArray(val)) summary[k] = `Array(${val.length})`;
                else if (typeof val === 'object' && val !== null) summary[k] = '{...}';
                else summary[k] = redactSensitiveText(String(val).slice(0, 80));
            }
        });
        return summary;
    } catch {
        return typeof data === 'string' ? redactSensitiveText(data.slice(0, 120)) : null;
    }
}

function pushBounded(list, item, maxLen) {
    list.unshift(item);
    if (list.length > maxLen) list.length = maxLen;
}

export function initTicketDiagnostics() {
    if (initialized || typeof window === 'undefined') return;
    initialized = true;

    try {
        axios.interceptors.response.use(
            (response) => response,
            (error) => {
                try {
                    if (error?.code === 'ERR_CANCELED') return Promise.reject(error);
                    const url = sanitizeUrl(error?.config?.url || '');
                    const status = error?.response?.status || 0;
                    const method = (error?.config?.method || 'GET').toUpperCase();
                    const resData = error?.response?.data;
                    const rawMsg = resData?.message || resData?.error || resData?.detalles || resData?.descripcionMsg || error?.message || 'Error en operación del servidor';

                    pushBounded(networkFailures, {
                        id: `net_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        kind: 'network', method, url, status,
                        statusText: error?.response?.statusText || (status === 0 ? 'Sin conexión / Red' : `HTTP ${status}`),
                        backendMessage: redactSensitiveText(String(rawMsg).slice(0, 350)),
                        payloadSummary: sanitizePayload(error?.config?.data),
                        route: window.location?.pathname || '/',
                        timestamp: new Date().toISOString(), timestampMs: Date.now()
                    }, MAX_NETWORK_LOGS);
                } catch { /* Noop */ }
                return Promise.reject(error);
            }
        );

        const originalConsoleError = console.error;
        console.error = function (...args) {
            try {
                const rawMsg = args
                    .map((a) => {
                        if (a instanceof Error) return `${a.name}: ${a.message}`;
                        if (typeof Element !== 'undefined' && a instanceof Element) return `<${a.tagName}>`;
                        if (typeof a === 'object' && a !== null) {
                            try { return JSON.stringify(a).slice(0, 220); } catch { return String(a); }
                        }
                        return String(a);
                    })
                    .join(' ')
                    .slice(0, 400);
                const msg = redactSensitiveText(rawMsg);

                if (msg && !msg.includes('Download the React DevTools')) {
                    const firstErr = args.find((a) => a instanceof Error);
                    pushBounded(consoleErrors, {
                        id: `con_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        kind: 'console', message: msg,
                        stack: firstErr?.stack ? redactSensitiveText(String(firstErr.stack).slice(0, 450)) : null,
                        route: window.location?.pathname || '/', timestamp: new Date().toISOString(), timestampMs: Date.now()
                    }, MAX_CONSOLE_LOGS);
                }
            } catch { /* Noop */ }
            return originalConsoleError.apply(console, args);
        };

        window.addEventListener('error', (event) => {
            try {
                const msg = redactSensitiveText(String(event?.error?.message || event?.message || 'Error de ejecución JS').slice(0, 350));
                pushBounded(consoleErrors, {
                    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    kind: 'runtime', message: msg,
                    stack: event?.error?.stack ? redactSensitiveText(String(event.error.stack).slice(0, 450)) : `${event?.filename || ''}:${event?.lineno || ''}`,
                    route: window.location?.pathname || '/', timestamp: new Date().toISOString(), timestampMs: Date.now()
                }, MAX_CONSOLE_LOGS);
            } catch { /* Noop */ }
        });

        window.addEventListener('unhandledrejection', (event) => {
            try {
                const reason = event?.reason;
                if (reason?.isAxiosError) return;
                const msg = redactSensitiveText(String(reason?.message || reason || 'Promesa rechazada no controlada').slice(0, 350));
                pushBounded(consoleErrors, {
                    id: `prm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    kind: 'promise', message: msg,
                    stack: reason?.stack ? redactSensitiveText(String(reason.stack).slice(0, 450)) : null,
                    route: window.location?.pathname || '/', timestamp: new Date().toISOString(), timestampMs: Date.now()
                }, MAX_CONSOLE_LOGS);
            } catch { /* Noop */ }
        });
    } catch { /* Noop */ }
}

const ROUTE_API_DOMAIN_MAP = [
    { routePattern: /venta|pos|factur|cotiz/i, apiPattern: /sale|pos|dte|invoice|quote|customer/i },
    { routePattern: /compra|gasto|proveedor/i, apiPattern: /purchase|expense|supplier|provider/i },
    { routePattern: /inventar|producto|kardex|bodega|traslado/i, apiPattern: /product|inventory|kardex|stock|transfer|warehouse/i },
    { routePattern: /caja|arqueo|corte|turno/i, apiPattern: /cash|shift|turn|closure|payment/i },
    { routePattern: /cliente|cxc|cobro/i, apiPattern: /customer|client|receivable|cxc|payment/i },
    { routePattern: /contab|partida|catalogo|libro|iva/i, apiPattern: /account|journal|ledger|tax|iva/i },
    { routePattern: /planilla|empleado|rh|asistencia/i, apiPattern: /payroll|employee|rh|attendance/i },
    { routePattern: /dte|hacienda|contingencia/i, apiPattern: /dte|hacienda|contingency|invalidation/i },
    { routePattern: /usuario|rol|seguridad|empresa|sucursal/i, apiPattern: /user|role|company|branch|auth|telegram/i }
];

const ACTION_VERBS_REGEX = /guardar|crear|emitir|enviar|anular|eliminar|borrar|actualizar|editar|procesar|cobrar|pagar|abrir|cerrar|imprimir|descargar|subir|error|falla|no deja|no funciona|no carga|bloquea/i;

function extractKeywords(text = '') {
    return String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !['para', 'como', 'este', 'esta', 'estos', 'cuando', 'donde', 'porque', 'pero', 'tiene', 'делать', 'favor', 'hola', 'buenos', 'dias', 'tardes', 'pantalla', 'sistema'].includes(w));
}

/**
 * Evalúa si los errores en consola o las operaciones fallidas previas tienen relación
 * con el problema reportado en el ticket.
 */
export function analyzeDiagnosticRelevance({
    currentRoute = '/',
    moduleName = '',
    subject = '',
    description = '',
    ticketType = 'problema'
} = {}) {
    const now = Date.now();
    const userText = `${subject} ${description} ${moduleName}`.trim();
    const userKeywords = extractKeywords(userText);
    const mentionsActionFailure = ACTION_VERBS_REGEX.test(userText);

    const evaluateEntry = (entry) => {
        let score = 0;
        const reasons = [];
        const ageSec = Math.max(0, Math.round((now - (entry.timestampMs || now)) / 1000));

        // 1. Proximidad temporal (máx 40 pts)
        if (ageSec <= 90) {
            score += 40;
            reasons.push(`Ocurrió hace ${ageSec}s (justo antes de abrir el ticket)`);
        } else if (ageSec <= 300) {
            score += 28;
            reasons.push(`Ocurrió hace ${Math.round(ageSec / 60)} min`);
        } else if (ageSec <= 900) {
            score += 15;
            reasons.push(`Ocurrió hace ${Math.round(ageSec / 60)} min`);
        } else {
            score += 5;
        }

        // 2. Coincidencia de pantalla o módulo (máx 30 pts)
        if (entry.route && currentRoute && entry.route === currentRoute) {
            score += 25;
            reasons.push(`Ocurrió en la misma pantalla (${currentRoute})`);
        } else if (entry.route && currentRoute && entry.route !== currentRoute) {
            score -= 8;
        }

        if (entry.kind === 'network' && entry.url) {
            const matchedDomain = ROUTE_API_DOMAIN_MAP.some(
                (m) => (m.routePattern.test(currentRoute) || m.routePattern.test(moduleName)) && m.apiPattern.test(entry.url)
            );
            if (matchedDomain) {
                score += 15;
                reasons.push(`El endpoint (${entry.method} ${entry.url}) pertenece al módulo actual`);
            }
        }

        // 3. Coincidencia semántica con lo que escribió el usuario (máx 25 pts)
        const targetText = `${entry.backendMessage || ''} ${entry.message || ''} ${entry.url || ''} ${entry.statusText || ''}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const matchedWords = userKeywords.filter((kw) => targetText.includes(kw));
        if (matchedWords.length > 0) {
            score += Math.min(20, matchedWords.length * 8);
            reasons.push(`Coincide con palabras clave del reporte (${matchedWords.slice(0, 3).join(', ')})`);
        }

        if (entry.kind === 'network' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(entry.method) && mentionsActionFailure) {
            score += 14;
            reasons.push(`Operación de escritura (${entry.method}) falló cuando el usuario intentaba procesar una acción`);
        }

        // 4. Severidad técnica del fallo (máx 15 pts)
        if (entry.kind === 'network') {
            if (entry.status >= 500 || entry.status === 0) {
                score += 15;
                reasons.push(`Error crítico de servidor/red (${entry.status || 'Red'})`);
            } else if ([400, 403, 409, 422].includes(entry.status)) {
                score += 12;
                reasons.push(`Rechazo de validación o permisos (HTTP ${entry.status})`);
            } else {
                score += 6;
            }
        } else if (entry.kind === 'runtime' || entry.kind === 'promise') {
            score += 14;
            reasons.push('Excepción de código en tiempo de ejecución');
        } else {
            score += 6;
        }

        if (ticketType === 'consulta' && score < 65) {
            score = Math.max(10, score - 15);
        }

        const clampedScore = Math.max(0, Math.min(100, score));
        return {
            ...entry,
            ageSeconds: ageSec,
            relevanceScore: clampedScore,
            isRelated: clampedScore >= 45,
            reasons
        };
    };

    const analyzedNetwork = networkFailures.map(evaluateEntry).sort((a, b) => b.relevanceScore - a.relevanceScore);
    const analyzedConsole = consoleErrors.map(evaluateEntry).sort((a, b) => b.relevanceScore - a.relevanceScore);
    const allAnalyzed = [...analyzedNetwork, ...analyzedConsole].sort((a, b) => b.relevanceScore - a.relevanceScore);

    const topEvent = allAnalyzed[0] || null;
    const maxScore = topEvent ? topEvent.relevanceScore : 0;
    const relatedCount = allAnalyzed.filter((e) => e.isRelated).length;

    let relevance = 'sin_errores';
    let verdictLabel = 'Sin errores previos en navegador o servidor';
    let explanation = 'El navegador y las peticiones al servidor operaron sin errores recientes antes de generar este ticket.';

    if (allAnalyzed.length > 0) {
        if (maxScore >= 70) {
            relevance = 'alta';
            verdictLabel = 'Alta probabilidad de ser la causa del problema';
            const primaryDesc = topEvent.kind === 'network'
                ? `${topEvent.method} ${topEvent.url} (HTTP ${topEvent.status || 'ERR'}): "${topEvent.backendMessage}"`
                : topEvent.message;
            explanation = `Se detectó una falla directa (${primaryDesc}) en esta pantalla hace ${topEvent.ageSeconds}s. ${topEvent.reasons.slice(0, 2).join(' · ')}.`;
        } else if (maxScore >= 45) {
            relevance = 'media';
            verdictLabel = 'Posible relación con el problema reportado';
            const primaryDesc = topEvent.kind === 'network'
                ? `${topEvent.method} ${topEvent.url} (${topEvent.backendMessage})`
                : topEvent.message;
            explanation = `Se encontraron ${relatedCount} evento(s) reciente(s) que podrían estar relacionados: ${primaryDesc}.`;
        } else {
            relevance = 'baja';
            verdictLabel = 'Errores previos en sesión pero sin relación aparente';
            explanation = `Existen ${allAnalyzed.length} registro(s) en la bitácora del navegador, pero ocurrieron en otra ruta o hace varios minutos y no parecen causar este reporte.`;
        }
    }

    return {
        relevance,
        score: maxScore,
        verdictLabel,
        explanation,
        relatedCount,
        totalEvents: allAnalyzed.length,
        topEvent,
        networkFailures: analyzedNetwork.slice(0, 10),
        consoleErrors: analyzedConsole.slice(0, 10),
        environment: {
            viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            online: typeof navigator !== 'undefined' ? navigator.onLine : true,
            memoryMb: typeof performance !== 'undefined' && performance.memory
                ? Math.round(performance.memory.usedJSHeapSize / 1048576)
                : null,
            capturedAt: new Date().toISOString()
        }
    };
}

export function clearTicketDiagnostics() {
    networkFailures.length = 0;
    consoleErrors.length = 0;
}
