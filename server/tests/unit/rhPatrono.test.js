const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../../src/config/db');
const {
    normalizeLegalName,
    isLegacyPatronoSeed,
    sanitizeRhConfigRow,
    fetchPatronoConfig,
    resolveContratoPatrono
} = require('../../src/services/rhPatrono.service');
const { generateContratoLaboralPDF } = require('../../src/services/rhContratoLaboralPdf.service');
const { contratoLaboralSchema } = require('../../src/schemas/rhSchemas');

describe('RH Patrono Multi-Tenant Isolation & Contract Resolution', () => {
    after(async () => {
        await pool.end();
    });

    it('normalizes comma typos in Salvadoran corporate suffixes', () => {
        assert.equal(
            normalizeLegalName('Inversiones Lil, S,A, de C,V.'),
            'Inversiones Lil, S.A. de C.V.'
        );
    });

    it('detects legacy v310 seed contamination only on non-owner companies', () => {
        const seededRow = {
            patrono_nombre: 'RAUL RAFAEL SOSA CASTELLANOS',
            patrono_edad: 58,
            patrono_sexo: 'MASCULINO',
            patrono_estado_civil: 'CASADO',
            patrono_profesion: 'ESTUDIANTE',
            patrono_dui: '00497414-6',
            patrono_nit: '0614-140268-004-3'
        };

        assert.equal(isLegacyPatronoSeed(seededRow, '0614-270114-103-3'), true);
        assert.equal(isLegacyPatronoSeed(seededRow, '0614-140268-004-3'), false);

        const legitimateRep = {
            patrono_nombre: 'MARIA ELENA GOMEZ',
            patrono_edad: 44,
            patrono_sexo: 'FEMENINO',
            patrono_estado_civil: 'CASADA',
            patrono_profesion: 'ADMINISTRADORA DE EMPRESAS',
            patrono_dui: '01234567-8',
            patrono_nit: '0614-270114-103-3'
        };
        assert.equal(isLegacyPatronoSeed(legitimateRep, '0614-270114-103-3'), false);
    });

    it('sanitizes unconfigured or contaminated rh_config rows without leaking SQL column defaults', () => {
        const unconfiguredRow = {
            patrono_nombre: '',
            patrono_edad: 58,
            patrono_sexo: 'MASCULINO',
            patrono_estado_civil: 'CASADO',
            patrono_profesion: 'ESTUDIANTE',
            patrono_dui_extendido: 'SAN SALVADOR'
        };
        const clean = sanitizeRhConfigRow(unconfiguredRow, '0614-270114-103-3');
        assert.equal(clean.patrono_nombre, '');
        assert.equal(clean.patrono_edad, null);
        assert.equal(clean.patrono_sexo, '');
        assert.equal(clean.patrono_estado_civil, '');
        assert.equal(clean.patrono_profesion, '');
        assert.equal(clean.patrono_dui_extendido, '');
    });

    it('resolves contract patrono atomically without mixing two entities', () => {
        const companyCfgWithRep = {
            company_razon_social: 'Inversiones Lil, S.A. de C.V.',
            company_nit: '0614-270114-103-3',
            company_tipo_persona: '2',
            has_configured_patrono: true,
            patrono_nombre: 'REPRESENTANTE CONFIGURADO',
            patrono_edad: 47,
            patrono_sexo: 'FEMENINO',
            patrono_estado_civil: 'CASADA',
            patrono_profesion: 'LICENCIADA',
            patrono_direccion: 'CARR. PANAMERICANA CA01 KM 19',
            patrono_nacionalidad: 'SALVADOREÑA',
            patrono_dui: '09998888-7',
            patrono_dui_extendido: 'SAN SALVADOR',
            patrono_nit: '0614-270114-103-3'
        };

        // Generic company-fallback contract upgrades cleanly when rh_config representative is configured
        const genericContract = {
            patrono_nombre: 'INVERSIONES LIL, S.A. DE C.V.',
            patrono_edad: null,
            patrono_dui: ''
        };
        const upgraded = resolveContratoPatrono(genericContract, companyCfgWithRep);
        assert.equal(upgraded.patrono_nombre, 'REPRESENTANTE CONFIGURADO');
        assert.equal(upgraded.patrono_edad, 47);
        assert.equal(upgraded.patrono_dui, '09998888-7');

        // Custom per-contract representative does NOT inherit another person's age or DUI
        const customContract = {
            patrono_nombre: 'APODERADO ESPECIAL',
            patrono_edad: null,
            patrono_sexo: '',
            patrono_dui: ''
        };
        const preserved = resolveContratoPatrono(customContract, companyCfgWithRep);
        assert.equal(preserved.patrono_nombre, 'APODERADO ESPECIAL');
        assert.equal(preserved.patrono_edad, null);
        assert.equal(preserved.patrono_dui, '');
    });

    it('coerces empty string patrono_edad to null instead of 0 in Zod schema', () => {
        const parsed = contratoLaboralSchema.parse({
            trabajador_nombre: 'JOSE DANIEL ESCOBAR RAMIREZ',
            cargo_laboral: 'VENDEDOR/A',
            lugar_trabajo: 'PISTA SAN MARTIN',
            fecha_inicio: '2026-08-07',
            fecha_creacion: '2026-11-14',
            patrono_nombre: 'INVERSIONES LIL, S.A. DE C.V.',
            patrono_edad: ''
        });
        assert.equal(parsed.patrono_edad, null);
    });

    it('returns Inversiones Lil data (not Raul Rafael Sosa Castellanos) for company 1 and CT-2026-0002', async () => {
        const cfg1 = await fetchPatronoConfig(1);
        assert.notEqual(cfg1.patrono_nombre.toUpperCase(), 'RAUL RAFAEL SOSA CASTELLANOS');
        assert.equal(cfg1.patrono_nit, '0614-270114-103-3');
        assert.notEqual(cfg1.patrono_dui, '00497414-6');

        const [rows] = await pool.query(
            `SELECT * FROM rh_contratos_laborales WHERE company_id = 1 AND codigo = 'CT-2026-0002' LIMIT 1`
        );
        assert.equal(rows.length, 1);
        const merged = { ...rows[0], ...resolveContratoPatrono(rows[0], cfg1) };
        assert.equal(merged.patrono_nombre.toUpperCase(), 'INVERSIONES LIL, S.A. DE C.V.');
        assert.equal(merged.patrono_nit, '0614-270114-103-3');
        assert.equal(merged.patrono_edad, null);
        assert.equal(merged.patrono_profesion, '');

        const pdfBuffer = await generateContratoLaboralPDF(merged);
        assert.ok(Buffer.isBuffer(pdfBuffer));
        assert.ok(pdfBuffer.length > 1500);

        // Company 2 keeps its own patrono data intact
        const cfg2 = await fetchPatronoConfig(2);
        assert.equal(cfg2.patrono_nombre.toUpperCase(), 'RAUL RAFAEL SOSA CASTELLANOS');
        assert.equal(cfg2.patrono_nit, '0614-140268-004-3');
    });
});

