const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const {
    formatDuiWords,
    formatDateWords,
    formatTimeWords,
    calculateAgeWords,
    resolveDepartmentName,
    resolveDistrictOrCity
} = require('../../utils/finiquitoLegalHelper');

/**
 * Builds the exact narrative clauses according to the Word template
 */
function buildFiniquitoClauses(data) {
    const isNatural = data.is_persona_natural === true || String(data.tipo_persona) === '1' || data.tipo_persona === 'natural';
    const empName = `${data.empleado_nombres || ''} ${data.empleado_apellidos || ''}`.trim().toUpperCase();
    const empEdad = data.edad_palabras || calculateAgeWords(data.fecha_nacimiento);
    const empDuiWords = formatDuiWords(data.num_dui);
    const empDepto = resolveDepartmentName(data.depto_nombre || data.empleado_departamento || data.departamento);
    
    const resolvedDist = resolveDistrictOrCity(data);
    const empDist = (data.distrito_nombre && isNaN(data.distrito_nombre))
        ? data.distrito_nombre.trim()
        : ((data.empleado_distrito && isNaN(data.empleado_distrito)) ? data.empleado_distrito.trim() : resolvedDist);
    const empMuni = (data.municipio_nombre && isNaN(data.municipio_nombre))
        ? data.municipio_nombre.trim()
        : ((data.empleado_municipio && isNaN(data.empleado_municipio)) ? data.empleado_municipio.trim() : empDist);
    const empDistMuni = empDist;

    const now = new Date();
    const dateWords = formatDateWords(data.fecha_documento || now);
    const timeWords = formatTimeWords(data.fecha_documento || now);

    const notarioNombre = (data.notario_nombre || 'KARIN ARMANDO BATRES ANGEL').trim().toUpperCase();
    const notarioDomicilio = data.notario_domicilio || 'San Martín';
    const notarioDepto = resolveDepartmentName(data.notario_departamento || 'San Salvador');

    const patronoNombre = (data.patrono_nombre || data.company_name || 'EMPLEADOR').trim().toUpperCase();
    const patronoOcupacion = data.patrono_ocupacion || 'mayor de edad, estudiante';
    const patronoDomicilio = data.patrono_domicilio || empMuni || 'San Salvador';
    const patronoDepto = resolveDepartmentName(data.patrono_departamento || 'San Salvador');
    const patronoDuiWords = data.patrono_dui ? formatDuiWords(data.patrono_dui) : 'cero cero cuatrocientos noventa y siete mil cuatrocientos catorce - seis';

    const sociedadNombre = (data.company_name || 'INVERSIONES LIL, S.A. DE C.V.').trim().toUpperCase();

    if (isNatural) {
        // PERSONA NATURAL TEMPLATE
        const p1 = `YO, ${empName}, de ${empEdad} años, salvadoreña(o), soltera(o), estudiante del domicilio de ${empDistMuni}, departamento de ${empDepto} portador(a) de mi documento único de identidad número ${empDuiWords}. Por este medio declaro:`;

        const r1 = `I) QUE OTORGO FINIQUITO AMPLIO Y SUFICIENTE a favor del señor(a) ${patronoNombre}, ${patronoOcupacion}, del domicilio de ${patronoDomicilio}, departamento de ${patronoDepto}, portador(a) de su Documento Único de Identidad número ${patronoDuiWords}; para los efectos jurídicos del artículo cuatrocientos dos del Código de Trabajo, por haber cumplido con todas las obligaciones patronales provenientes de la relación de trabajo que he tenido con dicha empresa; de la misma forma declaro que se me han cancelado los salarios adeudados hasta mi último día laboral trabajado, horas extra, vacaciones proporcionales y de años anteriores, aguinaldos proporcionales y de años anteriores, comisiones, y el pago de la prestación por Renuncia Voluntaria como lo establecen los artículos ocho y nueve de la LEY REGULADORA DE LA PRESTACION ECONOMICA POR RENUNCIA VOLUNTARIA que me corresponde hasta el día ${dateWords.dayWord.toUpperCase()} DE ${dateWords.month.toUpperCase()} DEL AÑO ${dateWords.yearWord.toUpperCase()} que hago efectiva mi renuncia voluntaria así como cualquier otra remuneración de carácter económica que Reconozca el Código de trabajo vigente o cualquier otra fuente de derecho laboral, proveniente de la relación laboral que tuve con el señor(a) ${patronoNombre}; por lo que por ser verdad lo anterior y para los efectos del artículo cuatrocientos dos del Código de Trabajo, OTORGO EL PRESENTE FINIQUITO LABORAL AMPLIO Y SUFICIENTE Y DECLARO SOLVENTE AL SEÑOR(A) ${patronoNombre}; DE CUALQUIER RESPONSABILIDAD U OBLIGACIÓN DE CARÁCTER PATRIMONIAL A MI FAVOR en su carácter de patrono u empleador o cualquier denominación que reconozca el Código de Trabajo.`;

        const r2 = `II) Así mismo declaro que me obligo a no divulgar o utilizar, transferir, compartir, ceder, vender, negociar, intercambiar o cualquier otra acción que implique la tradición, publicación o revelación en su sentido más amplio de la información en la que obtenga beneficio propio o para otras personas sean estas naturales o jurídicas de forma total o parcial la información del señor(a) ${patronoNombre}; y guardaré la estricta reserva de confidencialidad de la información, que por haber trabajado con el señor(a) ${patronoNombre} en razón del cargo que he desempeñado y en razón de ello reconozco responsabilidad que poseeré en caso de su divulgación, utilización, cesión, transferencia, venta, negociación, intercambio o cualquier forma de tradición de la información, en especial sobre los asuntos administrativos, operativos, ejecutivos y cualquier información cuya divulgación causaren perjuicios al señor(a) ${patronoNombre} declaro que comprendo que dicha información es considerada desde ya como secreto profesional entre mi persona y el señor(a) ${patronoNombre} y para los efectos legales correspondientes me obligo a no compartirla o utilizarla para beneficio propio o de terceras personas sean naturales o jurídicas. Declaro que estoy consciente que son secretos empresariales, entre otros, los relacionados a: estructura legal, organizacional y física del establecimiento de trabajo perteneciente al señor(a) ${patronoNombre} así como información de personal, procedimientos administrativos, contratos, información contable, tributaria y/o contractual; programas o software informáticos y tecnología especializada; información desde y hacia empresas filiales, matrices, proveedores, clientes, rutas de servicios, información técnica y/o comercial, contable, auditable, costos y precios, datos de los proveedores o de los clientes del señor(a) ${patronoNombre} datos relacionados a insumos, proceso de compra y sistemas de ventas en relación a los productos y servicios y/o actividades del señor(a) ${patronoNombre}, así como contraseñas o claves de acceso, ubicación de cámaras de seguridad o dispositivos de seguridad del establecimiento de trabajo. Además declaro que no divulgaré o utilizaré información protegida, así como el uso no autorizado de la misma por parte del señor(a) ${patronoNombre} se considera un incumplimiento de la presente obligación y en caso de comprobarse que he sido yo quien ha revelado información no autorizada por el empleador me hago responsable de los daños y perjuicios que me cause; la obligación que hoy constituyo, se mantiene aún después determinado la relación laboral por cualquier motivo, sea este por despido, por retiro voluntario, por abandono de trabajo, por renuncia o por mutuo consentimiento, por un tiempo de cinco años como mínimo en el caso de los secretos empresariales y en forma indefinida en el caso de los datos protegidos por leyes especiales. Además por el término de cinco años, de terminada la relación con el empleador, declaro que no voy directamente o indirectamente, dar a conocer a cualquier persona natural o jurídica, cualquier información de cualquiera de los empleados o familiares del empleador que haya conocido en razón de mi trabajo, sea esta persona jurídica o natural, por lo que el incumplimiento a lo anterior reconozco que seré responsable de los daños y perjuicios en contra del señor(a) ${patronoNombre} o de cualquier otra persona natural o jurídica afectada. Además me obligo a proporcionar, entregar, compartir con el señor(a) ${patronoNombre} cualquier tipo de información que sea de mi conocimiento en razón del cargo que he ejercido y me obligo incondicionalmente a entregar ya sea accesos, contraseñas, detalles de trámites pendientes, o cualquier otra información que sea necesaria, el incumplimiento de lo anterior y demás disposiciones contenidas en este documento reconozco que deberé de cancelar la suma de treinta mil dólares de los Estados Unidos de América en caso de incumplimiento.`;

        const r3 = `III) Declaro que en caso de incumplimiento de la obligación del romano II) designo como domicilio especial el de la ciudad de San Salvador, Departamento de San Salvador, a cuyos tribunales me someto expresamente. Y para constancia todo lo anterior, firmo voluntariamente la presente hoja, con mi puño y letra, así mismo acepto que son verdaderas todas y cada una de las declaraciones anteriores. En la ciudad de ${empDistMuni}, Departamento de ${empDepto}, ${dateWords.fullClosing}.`;

        const acta = `En la Ciudad de ${empDistMuni}, Departamento de ${empDepto}, ${timeWords} ${dateWords.fullNotary}. Ante mí, ${notarioNombre}, Notario del domicilio de ${notarioDomicilio}, departamento de ${notarioDepto}, comparece el/la señor(a) ${empName}, de ${empEdad} años, salvadoreña(o), soltera(o), estudiante del domicilio de ${empDistMuni}, departamento de ${empDepto} persona que hoy conozco e identifico por medio de su documento único de identidad número ${empDuiWords}. Y ME DICE: Que reconoce como suya la firma y conceptos del anterior instrumento que denomina como FINIQUITO, el cual literalmente dice: “ “ “ “ “ “ (…) ${p1} ${r1} ${r2} ${r3} (…) ” ” ” ” ”. YO EL SUSCRITO NOTARIO DOY FE: a) De ser Auténtica la firma que antecede a la presente acta notarial por haber sido puesta con su puño y letra por parte del compareciente en mi presencia; b) Que el compareciente ratifica el contenido de la presente acta notarial y declara comprender los conceptos en que otorga el finiquito amplio y suficiente y sus efectos jurídicos; además manifiesta comprender y ratificar todas las demás declaraciones expresadas. Así se expresó el/la compareciente, a quien expliqué los efectos legales de esta acta notarial, que consta en dos hojas útiles. Y Leído que le hube íntegramente lo escrito, en un solo acto, sin interrupción, ratifica su contenido y firmamos. DOY FE.`;

        return {
            isNatural: true,
            title: 'FINIQUITO LABORAL',
            empName,
            empDui: data.num_dui || '',
            beneficiarioNombre: patronoNombre,
            notarioNombre,
            year: dateWords.year,
            privateDocText: `${p1}\n\n${r1}\n\n${r2}\n\n${r3}`,
            actaText: acta,
            closingLocationDate: `En la ciudad de ${empDistMuni}, Departamento de ${empDepto}, ${dateWords.fullClosing}.`
        };
    } else {
        // PERSONA JURIDICA TEMPLATE
        const p1 = `Yo, ${empName}, de ${empEdad} años de edad, salvadoreña(o), ama de casa, soltera(o), del domicilio del distrito de ${empDist}, municipio de ${empMuni}, departamento de ${empDepto}, portador(a) de mi documento único de identidad número ${empDuiWords}. Por este medio declaro:`;

        const r1 = `I) POR ESTE MEDIO OTORGO EL PRESENTE FINIQUITO AMPLIO Y SUFICIENTE a favor de la sociedad ${sociedadNombre}, para los efectos jurídicos del artículo cuatrocientos dos del Código de Trabajo, por haber cumplido con todas las obligaciones patronales provenientes de la relación de trabajo que he tenido con dicha empresa; de la misma forma declaro que se me han cancelado todos los salarios que me corresponden hasta este día, horas extraordinarias diurnas y nocturnas, vacaciones proporcionales de este año y de años anteriores, aguinaldos proporcionales de este año y de años anteriores, comisiones o bonificaciones; así como la indemnización por despido injustificado o por retiro voluntario si fuera el caso; así como cualquier otra remuneración de carácter económica que Reconozca el Código de trabajo vigente o cualquier otra fuente de derecho laboral, proveniente de la relación laboral que tuve con la sociedad ${sociedadNombre}; por lo que por ser verdad lo anterior y para los efectos del artículo cuatrocientos dos del Código de Trabajo, otorgo el presente finiquito amplio y suficiente y declaro solvente a la sociedad ${sociedadNombre} de cualquier responsabilidad u obligación de carácter patrimonial a mi favor en su carácter de patrono u empleador o cualquier denominación que reconozca el código de trabajo, comprendiendo así al representante legal, jefaturas, supervisores y/o cualquier otra persona que labore para la sociedad ${sociedadNombre}.`;

        const r2 = `II) Así mismo declaro que me obligo a no divulgar o utilizar, transferir, compartir, ceder, vender, negociar, intercambiar o cualquier otra acción que implique la tradición de la información en la que obtenga beneficio propio o para otras personas sean estas naturales o jurídicas de forma total o parcial la información de la empresa ${sociedadNombre} y guardaré la estricta reserva de confidencialidad de la información, que por haber trabajado con la sociedad ${sociedadNombre} en razón del cargo que desempeñé y en razón de ello reconozco responsabilidad civil, mercantil o penal por la divulgación, utilización, cesión, transferencia, venta, negociación, intercambio o cualquier forma de tradición de la información, en especial sobre los asuntos administrativos, operativos, ejecutivos y cualquier información cuya divulgación causaren perjuicios a ${sociedadNombre}. Declaro que comprendo que dicha información es considerada desde ya como secreto profesional entre mi persona y ${sociedadNombre} y para los efectos legales correspondientes me obligo a no compartirla o utilizarla para beneficio propio o de terceras personas sean naturales o jurídicas. Declaro que estoy consciente que son secretos empresariales, entre otros, los relacionados a: estructura legal, organizacional y física de ${sociedadNombre}, información de personal, patentes, propiedad intelectual, procedimientos administrativos, contratos, información contable, tributaria y/o contractual; programas o software informáticos y tecnología especializada; información desde y hacia empresas filiales, matrices, proveedores, clientes, rutas de servicios, procedimientos técnicos de aplicación de químicos, etc.; información técnica y/o comercial, contable, auditable, costos y precios, datos de los proveedores o de los clientes de ${sociedadNombre}, datos relacionados a insumos, proceso de compra y sistemas de ventas en relación a los productos y servicios y/o actividades de ${sociedadNombre}. Además declaro que no divulgaré o utilizaré información protegida, así como el uso no autorizado de la misma por parte de ${sociedadNombre} trae como consecuencia un grave daño económico para ${sociedadNombre} y en consecuencia, la infracción a esta obligación me hago responsable de los daños y perjuicios que me cause ya sea en materia civil, mercantil o cuales otras relacionadas, sin perjuicio de la responsabilidad penal que pueda tener por la revelación o utilización de esta información de conformidad a los delitos contenidos en los artículos ciento ochenta y cuatro, ciento ochenta y cinco, ciento ochenta y seis, ciento ochenta y siete, doscientos treinta y doscientos treinta y uno, según sea el caso, del Código Penal. La obligación que hoy constituyo, se mantiene aún después de terminada la relación laboral por cualquier motivo, sea este por despido, por retiro voluntario, por abandono de trabajo, por renuncia o por mutuo consentimiento, por un tiempo de veinte años relacionados a los secretos empresariales y en forma indefinida en el caso de los datos protegidos y declaro que no emplearé útiles, productos, materiales en general, maquinarias, información, direcciones de clientes, procedimientos técnicos, rutas de servicios, información contable, financiera de cualquier naturaleza o herramientas que hayan sido suministrados por ${sociedadNombre} para un beneficio personal o terceras personas. Además por el término de CINCO AÑOS, de terminada la relación con ${sociedadNombre} declaro que no voy directamente o indirectamente, dar a conocer a cualquier persona natural o jurídica, los nombres, las direcciones o cualquier información de cualquiera de los clientes de la Empresa o cualquier otra información que les pertenece, o que visitaré, buscaré clientes, o me llevaré, o intentaré persuadir al personal de la empresa para visitar y buscar clientes de ${sociedadNombre} que haya contactado en razón de mi trabajo, para sí o para cualquier otra empresa que se dedique al mismo giro que ${sociedadNombre} sea esta persona jurídica o natural, por lo que el incumplimiento a lo anterior reconozco que seré responsable de los daños y perjuicios en contra de la empresa sin perjuicio de las acciones penales que acarrea, por lo que declaro no revelar dicha información.`;

        const r3 = `III) Declaro que en caso de incumplimiento de la obligación del romano II) designo como domicilio especial el de la ciudad de San Salvador, Departamento de San Salvador, a cuyos tribunales me someto expresamente. Y para constancia todo lo anterior, firmo voluntariamente la presente hoja, con mi puño y letra, así mismo acepto que son verdaderas todas y cada una de las declaraciones anteriores. En el distrito de ${empDist}, municipio de ${empMuni}, departamento de ${empDepto}, ${dateWords.fullClosing}.`;

        const acta = `En el distrito de ${empDist}, municipio de ${empMuni}, departamento de ${empDepto}, ${timeWords} ${dateWords.fullNotary}. Ante mí, ${notarioNombre}, Notario, del domicilio de ${notarioDomicilio}, departamento de ${notarioDepto}, comparece ${empName}, de ${empEdad} años de edad, salvadoreña(o), ama de casa, soltera(o), del domicilio del distrito de ${empDist}, municipio de ${empMuni}, departamento de ${empDepto}, persona que hoy conozco e identifico por medio de su documento único de identidad número ${empDuiWords}. Y ME DICE: Que reconoce como suya la firma y conceptos del anterior instrumento que denomina como FINIQUITO LABORAL, el cual literalmente dice: “ “ “ “ “ “ (…) ${p1} ${r1} ${r2} ${r3} (…) ” ” ” ” ”. YO EL SUSCRITO NOTARIO DOY FE: a) De ser Auténtica la firma que antecede a la presente acta notarial por haber sido puesta con su puño y letra por parte del compareciente en mi presencia; b) Que el compareciente ratifica el contenido de la presente acta notarial y declara comprender los conceptos en que otorga su renuncia y finiquito con sus efectos jurídicos; además manifiesta comprender y ratificar todas las demás declaraciones expresadas. Así se expresó el/la compareciente, a quien expliqué los efectos legales de esta acta notarial, que consta en dos hojas útiles. Y Leído que le hube íntegramente lo escrito, en un solo acto, sin interrupción, ratifica su contenido y firmamos. DOY FE.`;

        return {
            isNatural: false,
            title: 'FINIQUITO LABORAL',
            empName,
            empDui: data.num_dui || '',
            beneficiarioNombre: sociedadNombre,
            notarioNombre,
            year: dateWords.year,
            privateDocText: `${p1}\n\n${r1}\n\n${r2}\n\n${r3}`,
            actaText: acta,
            closingLocationDate: `En el distrito de ${empDist}, municipio de ${empMuni}, departamento de ${empDepto}, ${dateWords.fullClosing}.`
        };
    }
}

/**
 * Calculates optimal font size so text never overflows past available vertical height
 */
function fitTextFontSize(doc, textOrParagraphs, maxWidth, maxHeight, minSize = 6.5, maxSize = 8.5, preferredLineGap = 1.2) {
    for (let fs = maxSize; fs >= minSize; fs -= 0.2) {
        doc.fontSize(fs);
        let totalH = 0;
        if (Array.isArray(textOrParagraphs)) {
            for (const p of textOrParagraphs) {
                totalH += doc.heightOfString(p.trim(), { width: maxWidth, lineGap: preferredLineGap }) + 4;
            }
            totalH -= 4;
        } else {
            totalH = doc.heightOfString(textOrParagraphs.trim(), { width: maxWidth, lineGap: preferredLineGap });
        }
        if (totalH <= maxHeight) {
            return { fontSize: Number(fs.toFixed(1)), lineGap: preferredLineGap };
        }
    }
    return { fontSize: minSize, lineGap: 1.0 };
}

/**
 * Generates the Finiquito PDF document
 */
const generateFiniquitoPDF = (data) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: { top: 35, bottom: 30, left: 40, right: 40 },
                size: 'LETTER',
                bufferPages: true
            });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const M = 40;
            const W = 532;
            const clauses = buildFiniquitoClauses(data);

            // PAGE 1: Documento Privado de Finiquito Laboral
            let y = 35;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(clauses.title, M, y, { width: W, align: 'center' });
            y += 18;

            const paragraphs = clauses.privateDocText.split('\n\n');
            const p1Fit = fitTextFontSize(doc, paragraphs, W, 580, 6.5, 8.5, 1.2);

            doc.fontSize(p1Fit.fontSize).font('Helvetica').fillColor('#1e293b');
            for (const p of paragraphs) {
                doc.text(p.trim(), M, y, { width: W, align: 'justify', lineGap: p1Fit.lineGap });
                y = doc.y + 4;
            }

            // Firmas Página 1 (Garantizado en la misma página)
            const sigY = Math.max(doc.y + 18, 650);
            const sigW = 240;
            const sigX = M + (W - sigW) / 2;

            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(sigX, sigY).lineTo(sigX + sigW, sigY).stroke();
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(clauses.empName, sigX, sigY + 5, { width: sigW, align: 'center' });
            if (clauses.empDui) {
                doc.fontSize(7).font('Helvetica').fillColor('#64748b');
                doc.text(`DUI: ${clauses.empDui}`, sigX, sigY + 16, { width: sigW, align: 'center' });
            }

            // PAGE 2: Acta Notarial de Auténtica de Firma
            doc.addPage();
            y = 35;
            doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text('ACTA NOTARIAL DE AUTÉNTICA DE FIRMA', M, y, { width: W, align: 'center' });
            y += 18;

            const p2Fit = fitTextFontSize(doc, clauses.actaText, W, 560, 6.5, 8.0, 1.2);
            doc.fontSize(p2Fit.fontSize).font('Helvetica').fillColor('#1e293b');
            doc.text(clauses.actaText, M, y, { width: W, align: 'justify', lineGap: p2Fit.lineGap });

            // Firmas Página 2
            const p2SigY = Math.max(doc.y + 20, 640);
            const p2ColW = 210;

            // Compareciente
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(M + 20, p2SigY).lineTo(M + 20 + p2ColW, p2SigY).stroke();
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(clauses.empName, M + 20, p2SigY + 5, { width: p2ColW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('COMPARECIENTE', M + 20, p2SigY + 15, { width: p2ColW, align: 'center' });

            // Notario
            const p2RightX = M + W - p2ColW - 20;
            doc.strokeColor('#94a3b8').lineWidth(0.5).moveTo(p2RightX, p2SigY).lineTo(p2RightX + p2ColW, p2SigY).stroke();
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`LIC. ${clauses.notarioNombre}`, p2RightX, p2SigY + 5, { width: p2ColW, align: 'center' });
            doc.fontSize(6.5).font('Helvetica').fillColor('#64748b');
            doc.text('Abogado y Notario', p2RightX, p2SigY + 15, { width: p2ColW, align: 'center' });

            // PAGE 3: Carátula Notarial (Cubierta formal)
            doc.addPage();
            y = 120;
            doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(String(clauses.year), M, y, { width: W, align: 'center' });
            y += 50;

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#475569');
            doc.text('DOCUMENTO PRIVADO Y AUTENTICADO DE:', M, y, { width: W, align: 'center' });
            y += 20;

            doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e293b');
            doc.text('FINIQUITO LABORAL', M, y, { width: W, align: 'center' });
            y += 55;

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('OTORGADO POR:', M, y, { width: W, align: 'center' });
            y += 15;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(clauses.empName, M, y, { width: W, align: 'center' });
            y += 50;

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('A FAVOR DE:', M, y, { width: W, align: 'center' });
            y += 15;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(clauses.beneficiarioNombre, M, y, { width: W, align: 'center' });
            y += 55;

            doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b');
            doc.text('ANTE LOS OFICIOS DEL NOTARIO:', M, y, { width: W, align: 'center' });
            y += 15;
            doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a');
            doc.text(`LIC. ${clauses.notarioNombre}`, M, y, { width: W, align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = {
    generateFiniquitoPDF,
    buildFiniquitoClauses
};
