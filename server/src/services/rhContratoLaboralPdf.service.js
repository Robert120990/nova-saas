const PDFDocument = require('pdfkit');
const { numeroALetras } = require('../utils/numberToWords');

const DIAS_SEMANA = [
    'DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'
];

const MESES_MAYUS = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const MESES_MINUS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function parseLocalDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) return val;
    const str = String(val).trim().substring(0, 10);
    const parts = str.split('-');
    if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) return d;
    }
    const fallback = new Date(val);
    return isNaN(fallback.getTime()) ? null : fallback;
}

function calculateAge(birthDateVal, explicitAge) {
    if (explicitAge !== undefined && explicitAge !== null && explicitAge !== '' && !isNaN(Number(explicitAge)) && Number(explicitAge) > 0) {
        return Number(explicitAge);
    }
    const birth = parseLocalDate(birthDateVal);
    if (!birth) return '';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age > 0 ? age : '';
}

function formatLongSpanishDate(dateVal) {
    const d = parseLocalDate(dateVal);
    if (!d) return '—';
    const dayName = DIAS_SEMANA[d.getDay()];
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthName = MESES_MAYUS[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName}, ${dayNum} DE ${monthName} DE ${year}`;
}

function formatSalaryWords(amount) {
    const num = Math.max(0, parseFloat(amount) || 0);
    const entero = Math.floor(num);
    const decimal = Math.round((num - entero) * 100);
    const letras = numeroALetras(entero);
    return `${letras} CON ${String(decimal).padStart(2, '0')}/100 DOLARES`;
}

function formatClosingDateParts(dateVal) {
    const d = parseLocalDate(dateVal) || new Date();
    const day = d.getDate();
    const month = MESES_MINUS[d.getMonth()];
    const year = d.getFullYear();
    const dayWord = day === 1 ? 'un' : numeroALetras(day).toLowerCase();
    const yearWord = numeroALetras(year).toLowerCase();
    return { dayWord, month, yearWord };
}

function generateContratoLaboralPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'LETTER',
                margins: { top: 30, bottom: 20, left: 42, right: 42 },
                bufferPages: true,
                autoFirstPage: true
            });

            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 42;
            const W = 528; // 612 - 84

            const empNombre = (data.trabajador_nombre || '').trim().toUpperCase();
            const empEdad = calculateAge(data.fecha_nacimiento, data.edad);
            const empSexo = (data.sexo || 'MASCULINO').trim().toUpperCase();
            const empEstadoCivil = (data.estado_civil || 'SOLTERO').trim().toUpperCase();
            const empProfesion = (data.profesion_oficio || 'ESTUDIANTE').trim().toUpperCase();
            const empDireccion = (data.direccion || '').trim().toUpperCase();
            const empNacionalidad = (data.nacionalidad || 'SALVADOREÑO').trim().toUpperCase();
            const empDui = (data.num_dui || '').trim();
            const empExtendido = (data.dui_extendido_en || '').trim().toUpperCase();
            const empNit = (data.num_nit || '').trim();
            const empIsss = (data.num_isss || '').trim();

            const patNombre = (data.patrono_nombre || 'RAUL RAFAEL SOSA CASTELLANOS').trim().toUpperCase();
            const patEdad = data.patrono_edad || 58;
            const patSexo = (data.patrono_sexo || 'MASCULINO').trim().toUpperCase();
            const patEstadoCivil = (data.patrono_estado_civil || 'CASADO').trim().toUpperCase();
            const patProfesion = (data.patrono_profesion || 'ESTUDIANTE').trim().toUpperCase();
            const patDireccion = (data.patrono_direccion || 'LOMAS DE SAN FRANCISCO 3a ETAPA AV. 3. # 9 B').trim().toUpperCase();
            const patNacionalidad = (data.patrono_nacionalidad || 'SALVADOREÑA').trim().toUpperCase();
            const patDui = (data.patrono_dui || '00497414-6').trim();
            const patExtendido = (data.patrono_dui_extendido || 'SAN SALVADOR').trim().toUpperCase();
            const patNit = (data.patrono_nit || '0614-140268-004-3').trim();

            const lugarTrabajo = (data.lugar_trabajo || 'OFICINA PRINCIPAL').trim().toUpperCase();
            const cargoLaboral = (data.cargo_laboral || 'EMPLEADO').trim().toUpperCase();
            const plazoContrato = (data.plazo_contrato || 'TIEMPO INDEFINIDO').trim().toUpperCase();
            const fechaInicioLarga = formatLongSpanishDate(data.fecha_inicio);
            const jefeInmediato = (data.jefe_inmediato || '').trim().toUpperCase();

            const diaInicio = (data.horario_dia_inicio || 'LUNES').trim().toUpperCase();
            const diaFin = (data.horario_dia_fin || 'VIERNES').trim().toUpperCase();
            const manDesde = (data.horario_manana_desde || '8:00 A.M.').trim().toUpperCase();
            const manHasta = (data.horario_manana_hasta || '12:00 P.M.').trim().toUpperCase();
            const tarDesde = (data.horario_tarde_desde || '1:00 P.M.').trim().toUpperCase();
            const tarHasta = (data.horario_tarde_hasta || '5:00 P.M.').trim().toUpperCase();
            const diaExtra = (data.horario_dia_extra || 'SABADO').trim().toUpperCase();
            const extDesde = (data.horario_extra_desde || '8:00 A.M.').trim().toUpperCase();
            const extHasta = (data.horario_extra_hasta || '12:00 P.M.').trim().toUpperCase();
            const horasSemana = data.total_horas_semana || 44;

            const salarioLetras = formatSalaryWords(data.salario_mensual);
            const formaPago = (data.forma_pago || 'TRANFERENCIA BANCARIA').trim().toUpperCase();
            const lugarPago = (data.lugar_trabajo || data.lugar_pago || lugarTrabajo).trim().toUpperCase();
            const herramientas = (data.herramientas_materiales || 'las herramientas y utensilios necesarios para el buen desempeño de sus funciones.').trim();
            const otrasEstipulaciones = (
                data.otras_estipulaciones ||
                'CUANDO POR LA NATURALEZA DEL NEGOCIO TENGA QUE EL TRABAJAR EL DIA DOMINGO, SE SUSTITUIRA EL DIA DE DESCANDO SEMANAL POR CUALQUIER DIA DE LA SEMANA, PREVIO ACUERDO ENTRE AMBAS PARTES.'
            ).trim().toUpperCase();
            const lugarCreacion = (data.lugar_creacion || 'SAN SALVADOR').trim().toUpperCase();
            const closingParts = formatClosingDateParts(data.fecha_creacion);

            // =========================================================================
            // PAGE 1
            // =========================================================================
            let y = 34;

            doc.font('Times-Bold').fontSize(12.5).fillColor('#000000')
               .text('CONTRATO INDIVIDUAL DE TRABAJO', M, y, { width: W, align: 'center' });

            y += 18;

            // Column Headers
            const leftX = M;
            const rightX = M + 276;
            doc.font('Times-Bold').fontSize(8).fillColor('#000000');
            doc.text('DATOS DEL TRABAJADOR', leftX, y, { width: 250, align: 'center' });
            doc.text('DATOS DEL PATRONO', rightX, y, { width: 252, align: 'center' });

            y += 13;

            const drawFieldRow = (colX, rowY, label, value, valOffset = 80, valW = 172) => {
                doc.font('Times-Bold').fontSize(8.5).text(label, colX, rowY);
                doc.font('Times-Roman').fontSize(8.5).text(String(value || ''), colX + valOffset, rowY, { width: valW, lineBreak: false });
            };

            const rH = 12.5;
            // Row 1: Nombre
            drawFieldRow(leftX, y, 'Nombre', empNombre, 52, 215);
            drawFieldRow(rightX, y, 'Nombre', patNombre, 52, 205);
            y += rH;

            // Row 2: Edad + Sexo
            doc.font('Times-Bold').fontSize(8.5).text('Edad', leftX, y);
            doc.font('Times-Roman').fontSize(8.5).text(String(empEdad), leftX + 38, y);
            doc.font('Times-Bold').fontSize(8.5).text('Sexo', leftX + 86, y);
            doc.font('Times-Roman').fontSize(8.5).text(empSexo, leftX + 122, y);

            doc.font('Times-Bold').fontSize(8.5).text('Edad', rightX, y);
            doc.font('Times-Roman').fontSize(8.5).text(String(patEdad), rightX + 38, y);
            doc.font('Times-Bold').fontSize(8.5).text('Sexo', rightX + 86, y);
            doc.font('Times-Roman').fontSize(8.5).text(patSexo, rightX + 122, y);
            y += rH;

            // Row 3: Estado Civil
            drawFieldRow(leftX, y, 'Estado Civil', empEstadoCivil, 60, 190);
            drawFieldRow(rightX, y, 'Estado Civil', patEstadoCivil, 60, 190);
            y += rH;

            // Row 4: Profesion u Oficio
            drawFieldRow(leftX, y, 'Profesion u Oficio', empProfesion, 82, 180);
            drawFieldRow(rightX, y, 'Profesion u Oficio', patProfesion, 82, 180);
            y += rH;

            // Row 5: Direccion
            drawFieldRow(leftX, y, 'Direccion', empDireccion, 60, 210);
            drawFieldRow(rightX, y, 'Direccion', patDireccion, 60, 210);
            y += rH + 7;

            // Row 6: Nacionalidad
            drawFieldRow(leftX, y, 'Nacionalidad', empNacionalidad, 60, 190);
            drawFieldRow(rightX, y, 'Nacionalidad', patNacionalidad, 60, 190);
            y += rH;

            // Row 7: DUI No.
            drawFieldRow(leftX, y, 'DUI No.', empDui, 52, 190);
            drawFieldRow(rightX, y, 'DUI No.', patDui, 52, 190);
            y += rH;

            // Row 8: Extendido en
            drawFieldRow(leftX, y, 'Extendido en', empExtendido, 60, 190);
            drawFieldRow(rightX, y, 'Extendido en', patExtendido, 60, 190);
            y += rH;

            // Row 9: NIT
            drawFieldRow(leftX, y, 'NIT', empNit, 52, 190);
            drawFieldRow(rightX, y, 'NIT', patNit, 52, 190);
            y += rH;

            // Row 10: ISSS No.
            drawFieldRow(leftX, y, 'ISSS No.', empIsss, 52, 190);
            y += rH + 4;

            // LUGAR DE TRABAJO
            doc.font('Times-Bold').fontSize(9.5)
               .text(`LUGAR DE TRABAJO: ${lugarTrabajo}`, leftX, y, { underline: true });
            y += 18;

            // Nosotros :
            const nosLineW = 185;
            const nosLeftX = M + 75;
            const nosRightX = M + 295;

            doc.font('Times-Roman').fontSize(7.2)
               .text(empNombre, nosLeftX, y, { width: nosLineW, align: 'center' })
               .text(patNombre, nosRightX, y, { width: nosLineW, align: 'center' });

            const lineY = y + 11;
            doc.strokeColor('#000000').lineWidth(0.7)
               .moveTo(nosLeftX, lineY).lineTo(nosLeftX + nosLineW, lineY).stroke()
               .moveTo(nosRightX, lineY).lineTo(nosRightX + nosLineW, lineY).stroke();

            doc.font('Times-Roman').fontSize(9.5).text('Nosotros :', M + 28, y + 11);
            doc.font('Helvetica-Bold').fontSize(7.2)
               .text('Nombre del Trabajador (a)', nosLeftX, lineY + 3, { width: nosLineW, align: 'center' })
               .text('Nombre del Contratante Patronal', nosRightX, lineY + 3, { width: nosLineW, align: 'center' });

            y = lineY + 18;

            // Intro Paragraph
            doc.font('Times-Roman').fontSize(9.2)
               .text('De las generales arriba indicadas y actuando en el carácter que aparece expresado. Actuando en mi carácter personal; convenimos en celebrar el presente ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Bold').text('CONTRATO INDIVIDUAL DE TRABAJO ', { continued: true })
               .font('Times-Roman').text('a las siguientes estipulaciones:');

            y = doc.y + 8;

            // A) CLASE DE TRABAJO O SERVICIO:
            doc.font('Times-Bold').fontSize(9.2).text('A) CLASE DE TRABAJO O SERVICIO:', M, y);
            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('El trabajador se compromete a prestar sus servicios al patrono en el cargo de ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Bold').text(`${cargoLaboral}. `, { underline: true, continued: true })
               .font('Times-Roman').text(
                   'Además de las obligaciones que le impongan las leyes laborales y sus reglamentos, el contrato colectivo de trabajo, si lo hubiere y el reglamento interno de trabajo, tendrá como obligaciones propias de su cargo el ser diligente con su trabajo, cumplir los horarios establecidos, respetar a los compañeros de trabajo y todas las demas obligaciones que esten relacionadas de forma directa o indirecta con lo que habitualmente se realiza en sus funciones designadas dentro de la empresa o las que el supervisor o jefaturas establezcan según la visión y misión de la empresa. Y aquellas establecidas en la descripción de funciones y obligaciones de los puestos laborales de la empresa, que para efectos del presente contrato forman parte integrante de las obligaciones laborales frente a la empresa.',
                   { underline: false }
               );

            y = doc.y + 8;

            // B) DURACION DEL CONTRATO Y TIEMPO DE SERVICIO
            doc.font('Times-Bold').fontSize(9.2).text('B) DURACION DEL CONTRATO Y TIEMPO DE SERVICIO', M, y);
            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('El presente contrato se celebra por: ', M, y, { continued: true })
               .font('Times-Bold').text(`${plazoContrato}.`, { underline: true });
            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('A partir del: ', M, y, { width: W, align: 'justify', lineGap: 1.5, continued: true })
               .font('Times-Bold').text(`${fechaInicioLarga}. `, { underline: true, continued: true })
               .font('Times-Roman').text(
                   'Fecha desde la cual el trabajador presta servicios al patrono sin que la relacion laboral se haya disusuelto. Queda estipulado para trabajadores de nuevo ingreso que los primero treinta dias serán de prueba y dentro de este término, cualquiera de las partes podrá dar por terminado el contrato sin empresión de causa ni responsabilidad alguna en cumplimiento al articulo 28 del código de trabajo vigente.',
                   { underline: false }
               );

            y = doc.y + 8;

            // C) LUGAR DE PRESTACIÓN DE SERVICIOS Y ALOJAMIENTO:
            doc.font('Times-Bold').fontSize(9.2)
               .text('C) LUGAR DE PRESTACIÓN DE SERVICIOS Y ALOJAMIENTO: ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Roman').text('El lugar de prestación de servicios será: ', { continued: true })
               .font('Times-Bold').text(`${lugarTrabajo}, `, { underline: true, continued: true })
               .font('Times-Roman').text('sin embargo, según la naturaleza de las labores estas podrán ser ejecutadas en lugares fuera de la empresa, cuando sea necesario. Y el trabajador habitara en ', { underline: false, continued: true })
               .font('Times-Bold').text('En su propia casa', { underline: true, continued: true })
               .font('Times-Roman').text(' Dado que la empresa ', { underline: false, continued: true })
               .font('Times-Bold').text('NO ', { underline: false, continued: true })
               .font('Times-Roman').text('se le proporcionara alojamiento.', { underline: false });

            y = doc.y + 8;

            // D) HORARIO DE TRABAJO:
            doc.font('Times-Bold').fontSize(9.2).text('D) HORARIO DE TRABAJO:', M, y);
            y = doc.y + 1.5;

            doc.font('Times-Roman').fontSize(9.2)
               .text('Del día ', M, y, { continued: true })
               .font('Times-Bold').text(diaInicio, { underline: true, continued: true })
               .font('Times-Roman').text(' al día ', { underline: false, continued: true })
               .font('Times-Bold').text(diaFin, { underline: true, continued: true })
               .font('Times-Roman').text(' de ', { underline: false, continued: true })
               .font('Times-Bold').text(manDesde, { underline: true, continued: true })
               .font('Times-Roman').text('  a ', { underline: false, continued: true })
               .font('Times-Bold').text(manHasta, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('Y de ', M, y, { continued: true })
               .font('Times-Bold').text(tarDesde, { underline: true, continued: true })
               .font('Times-Roman').text('  a  ', { underline: false, continued: true })
               .font('Times-Bold').text(tarHasta, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('Día ', M, y, { continued: true })
               .font('Times-Bold').text(diaExtra, { underline: true, continued: true })
               .font('Times-Roman').text(' de ', { underline: false, continued: true })
               .font('Times-Bold').text(extDesde, { underline: true, continued: true })
               .font('Times-Roman').text('  a  ', { underline: false, continued: true })
               .font('Times-Bold').text(extHasta, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('Semana laboral de ', M, y, { continued: true })
               .font('Times-Bold').text(String(horasSemana), { underline: true, continued: true })
               .font('Times-Bold').text(' horas', { underline: false });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('Únicamente podrán ejecutarse trabajos extraordinarios cuando se reciba la orden de verificarlos, dado ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Bold').text('VERBALMENTE', { underline: true, continued: true })
               .font('Times-Roman').text(' por el patrono: ', { underline: false, continued: Boolean(jefeInmediato) });
            if (jefeInmediato) {
                doc.font('Times-Bold').text(jefeInmediato, { underline: true });
            }

            y = doc.y + 8;

            // E) SALARIO
            doc.font('Times-Bold').fontSize(9.2).text('E) SALARIO', M, y);
            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('El salario que recibirá el trabajador, por sus servicios será la suma de: ', M, y, { continued: true })
               .font('Times-Bold').text(salarioLetras, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('Se pagara en dólares de los Estados Unidos de Norte América en: ', M, y, { continued: true })
               .font('Times-Bold').text(lugarPago, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('Dicho pago se hará de la manera siguiente ', M, y, { continued: true })
               .font('Times-Bold').text(formaPago, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('La operación del pago principiara y se continuara sin interrupción, a mas tardar dentro de las horas siguientes a la terminación de la jornada de trabajo correspondiente a la fecha respectiva, y únicamente se admitirán reclamos después de pagada la planilla el día ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Bold').text('HABIL SIGUIENTE', { underline: true });

            y = doc.y + 8;

            // F) HERRAMIENTAS Y MATERIALES:
            doc.font('Times-Bold').fontSize(9.2).text('F) HERRAMIENTAS Y MATERIALES:', M, y);
            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(9.2)
               .text('El patrono suministrara al trabajador las herramientas y materiales siguientes: ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Bold').text(herramientas, { underline: true });

            // Footer Page 1
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000')
               .text('Página 1 de 2', M, 750, { width: W, align: 'center', lineBreak: false });

            // =========================================================================
            // PAGE 2
            // =========================================================================
            doc.addPage();
            y = 36;

            doc.font('Times-Roman').fontSize(9.2)
               .text('Que se entregan en: ', M, y, {
                   width: W,
                   align: 'justify',
                   lineGap: 1.5,
                   continued: true
               })
               .font('Times-Bold').text('Excelente calidad y buen estado', { underline: true, continued: true })
               .font('Times-Roman').text(
                   '  y deben ser devueltos así por el trabajador cuando sea requerido al efecto por sus jefes inmediatos, salvo la disminución o deterioro causados por caso fortuito o fuerza mayor, o por la acción del tiempo, o por consumo y uso normal de los mismos.',
                   { underline: false }
               );

            y = doc.y + 10;

            // G) PERSONAS QUE DEPENDAN ECONOMICAMENTE DEL TRABAJADOR.
            doc.font('Times-Bold').fontSize(9.2)
               .text('G) PERSONAS QUE DEPENDAN ECONOMICAMENTE DEL TRABAJADOR.', M, y);
            y = doc.y + 6;

            // Dependents 4-row table
            let deps = [];
            if (Array.isArray(data.dependientes)) {
                deps = data.dependientes;
            } else if (typeof data.dependientes === 'string') {
                try { deps = JSON.parse(data.dependientes); } catch { deps = []; }
            }

            const colWidths = [132, 136, 48, 212]; // Total = 528
            const colX = [
                M,
                M + colWidths[0],
                M + colWidths[0] + colWidths[1],
                M + colWidths[0] + colWidths[1] + colWidths[2]
            ];
            const tblHeaderH = 15;
            const tblRowH = 16;

            // Header row
            doc.strokeColor('#000000').lineWidth(0.8);
            const headers = ['Nombre', 'Apellido', 'Edad', 'Direccion'];
            headers.forEach((h, i) => {
                doc.rect(colX[i], y, colWidths[i], tblHeaderH).stroke();
                doc.font('Times-Bold').fontSize(8).text(h, colX[i] + 4, y + 3.5, { width: colWidths[i] - 8 });
            });
            y += tblHeaderH;

            const totalRows = Math.max(4, deps.length);
            for (let r = 0; r < totalRows; r++) {
                const dep = deps[r] || {};
                const depAge = dep.nombre ? calculateAge(dep.fecha_nacimiento, dep.edad) : '';
                const vals = [
                    (dep.nombre || '').toUpperCase(),
                    (dep.apellido || '').toUpperCase(),
                    depAge !== '' ? String(depAge) : '',
                    (dep.direccion || '').toUpperCase()
                ];
                vals.forEach((v, i) => {
                    doc.rect(colX[i], y, colWidths[i], tblRowH).stroke();
                    if (v) {
                        doc.font('Times-Roman').fontSize(7.2).text(v, colX[i] + 4, y + 4.5, {
                            width: colWidths[i] - 8,
                            lineBreak: false
                        });
                    }
                });
                y += tblRowH;
            }

            y += 6;

            // H) OTRAS ESTIPULACIONES
            doc.font('Times-Bold').fontSize(9.2).text('H) OTRAS ESTIPULACIONES', M, y);
            y = doc.y + 2;
            doc.font('Times-Bold').fontSize(9)
               .text(otrasEstipulaciones, M, y, { width: W, align: 'justify', lineGap: 1.4, underline: true });

            y = doc.y + 5;

            // I) CLAUSULA DE CONFIDENCIALIDAD
            doc.font('Times-Roman').fontSize(8.8)
               .text(
                   'I) EL TRABAJOR/A se compromete a prestar sus servicios en forma exclusiva y realizar el trabajo convenido, debiendo desempeñar el trabajo con diligencia, eficiencia y en la forma, tiempo y lugar convenidos; guardando rigurosa reserva y estricta confidencialidad de los secretos e informacion. Por lo que con la firma del contrato se obliga a no divulgar, utilizar, compartir, publicar, enjenar, intercambiar, u obtener un beneficio personal o para terceras personas en estas naturales o juridicas, de la informacion de los que tuviera conocimiento en razón de su cargo y en razón de donde lo desempeñe y sobre los asuntos administrativos cuya divulgacion causaren prejuicios a ',
                   M, y,
                   { width: W, align: 'justify', lineGap: 1.35, continued: true }
               )
               .font('Times-Bold').text(`${patNombre}. `, { underline: true, continued: true })
               .font('Times-Roman').text(
                   'Dicha información es considerada desde ya como SECRETO PERSONAL entre las partes para los efectos legales correspondientes. El TRABAJOR/A declara conocer que son secretos empresariales, entre otros, los relacionados a: estructura legal, organizacional y fisica, informacion de personal, patentes, propiedad intelectual, procedimientos administrativos, contratos, informacion contable, tributaria y/o contractual; programas o softwares informaticos y tecnologia especializada; información desde y hacia empresas filiales, matrices, proveedores, clientes, etc.; informacionn tecnica y comercial, costos y precios, datos de los proveedores o clientes; datos relacionados a insumos, procesos de compra y sistemas de venta en relacion a los productos y servicios y/o actividades de ',
                   { underline: false, continued: true }
               )
               .font('Times-Bold').text(`${patNombre}.`, { underline: true });

            y = doc.y + 1.5;
            doc.font('Times-Roman').fontSize(8.8)
               .text(
                   'Ademas el TRABAJOR/A declara conocer que la divulgacion de información protegida, asi como el uso no autorizados de la misma. Tiene como como consecuencia un grave daño economico para el patrono y en consecuencia, la infracción a esta norma implica falta grave, sin perjuicio del derecho de acción penal que le asiste en especial de conformidad a los delitos contenidos en los articulos 184, 185, 186, 187, 230 y 231 segun sea el caso, del código penal. La obligacion contenida en la presente cláusula, se mantiene aun despues de termindo el presente contrato sea por despido, retiro voluntario, renuncia, abandono o cualquier otra causa de terminacion de contrato reconocida por la ley por un tiempo adicional de ',
                   M, y,
                   { width: W, align: 'justify', lineGap: 1.35, continued: true }
               )
               .font('Times-Bold').text('CINCO AÑOS ', { continued: true })
               .font('Times-Roman').text(
                   'contados desde la fecha que dejare de trabajar para el patrono; en el caso de los secretos empresariales y en forma indefinida en el caso de los datos protegidos de carácter bancario o financiero. Se le prohibe al TRABAJOR/A emplear útiles, productos, materiales enn general, maquinarias informacion o herramientas suministrador por el patrono; para un objeto distinto de aquel al que estan normalmente destinados o en beneficio propio o de personas ajenas a los clientes. Ademas por el termino de ',
                   { continued: true }
               )
               .font('Times-Bold').text('CINCO AÑOS', { continued: true })
               .font('Times-Roman').text(
                   ', de terminada la relacion laboral, EL TRABAJOR/A declara y acepta con firma en el presente contrato que no va a realizar directa o indirectamente, dar a conocer a cualquier persona, firma o corporacion los nombres o las direcciones de cualquiera de los clientes o empleados de la empresa o que visitara, buscara clientes, o se llevara, o intentara persuadir al personal de la empresa para visitar o buscar clientes, por lo que el incumplimiento a lo anterior reconozco que sere responsable de los daños y perjuicios en contra de la empresa sin perjuicio de las acciones penales que acarrea, por lo que declaro no revelar dicha informacion.'
               );

            y = doc.y + 4;

            // J)
            doc.font('Times-Roman').fontSize(8.8)
               .text(
                   'J) En el presente contrato individual de trabajo se entenderán incluidos, según el caso, los derechos y deberes laborales establecidos por las leyes y reglamentos de trabajo pertinentes, por el reglamento interno y por el o los contratos colectivos de trabajo que celebre el patrono; los reconocidos en las sentencias que resuelvan conflictos colectivos de trabajo en la empresa y los consagrados por la costumbre.',
                   M, y,
                   { width: W, align: 'justify', lineGap: 1.35 }
               );

            y = doc.y + 4;

            // K)
            doc.font('Times-Roman').fontSize(8.8)
               .text(
                   'K) Este contrato sustituye cualquier otro convenio de trabajo anterior, ya sea escrito o verbal, que haya estado vigente entre el patrono y el trabajador, pero no altera en manera alguna los derechos y prerrogativas del trabajador que emanen de su antigüedad en el servicio; ni se entenderá como negativa de mejores condiciones concedidas al trabajador en el contrato inmediato anterior y que consten en el presente.',
                   M, y,
                   { width: W, align: 'justify', lineGap: 1.35 }
               );

            y = doc.y + 5;

            // Closing lines
            doc.font('Times-Roman').fontSize(9.2)
               .text('En fe de lo cual firmamos el presente documento por triplicado en   ', M, y, { continued: true })
               .font('Times-Bold').text(lugarCreacion, { underline: true });

            y = doc.y + 6;
            doc.font('Times-Roman').fontSize(9.2)
               .text('A los ', M, y, { continued: true })
               .font('Times-Bold').text(closingParts.dayWord, { underline: true, continued: true })
               .font('Times-Roman').text(' días del mes ', { underline: false, continued: true })
               .font('Times-Bold').text(closingParts.month, { underline: true, continued: true })
               .font('Times-Roman').text(' de ', { underline: false, continued: true })
               .font('Times-Bold').text(`${closingParts.yearWord}.`, { underline: true });

            // Signatures and Fingerprint Boxes at bottom of Page 2
            const sigBaseY = Math.max(doc.y + 32, 682);

            // Fingerprint boxes on the right
            const fpBoxW = 43;
            const fpBoxH = 54;
            const fp1X = M + W - (fpBoxW * 2) - 18;
            const fp2X = fp1X + fpBoxW + 4;
            const fpTopY = sigBaseY - 26;

            doc.font('Helvetica-Bold').fontSize(6.2)
               .text('SI EL TRABAJADOR/A NO PUEDE FIRMAR', fp1X - 32, fpTopY - 11, { width: (fpBoxW * 2) + 68, align: 'center', lineBreak: false });

            doc.strokeColor('#000000').lineWidth(0.9)
               .rect(fp1X, fpTopY, fpBoxW, fpBoxH).stroke()
               .rect(fp2X, fpTopY, fpBoxW, fpBoxH).stroke();

            // Left signature (Patrono)
            const s1X = M;
            const sLineW = 165;
            doc.font('Helvetica-Bold').fontSize(8.5).text('F.', s1X, sigBaseY - 9);
            doc.strokeColor('#000000').lineWidth(0.8)
               .moveTo(s1X + 16, sigBaseY).lineTo(s1X + 16 + sLineW, sigBaseY).stroke();
            doc.font('Times-Roman').fontSize(7.2)
               .text(patNombre, s1X + 16, sigBaseY + 4, { width: sLineW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(7.8)
               .text('Patrono o Representante', s1X + 16, sigBaseY + 15, { width: sLineW, align: 'center' });

            // Middle signature (Trabajador)
            const s2X = M + 202;
            doc.font('Helvetica-Bold').fontSize(8.5).text('F.', s2X, sigBaseY - 9);
            doc.strokeColor('#000000').lineWidth(0.8)
               .moveTo(s2X + 16, sigBaseY).lineTo(s2X + 16 + sLineW, sigBaseY).stroke();
            doc.font('Times-Roman').fontSize(7.2)
               .text(empNombre, s2X + 16, sigBaseY + 4, { width: sLineW, align: 'center' });
            doc.font('Helvetica-Bold').fontSize(7.8)
               .text('Trabajador', s2X + 16, sigBaseY + 15, { width: sLineW, align: 'center' });

            // Footer Page 2
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000000')
               .text('Página 2 de 2', M, 750, { width: W, align: 'center', lineBreak: false });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateContratoLaboralPDF,
    calculateAge,
    formatLongSpanishDate,
    formatSalaryWords,
    formatClosingDateParts
};
