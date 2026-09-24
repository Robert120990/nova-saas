const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    agreementSchema,
    crmSettingsSchema,
    quotationCreateSchema,
    quotationStatusSchema,
    quotationEmailSchema,
    userSignatureSchema
} = require('../../src/schemas/crmSchemas');

const {
    companyCreateSchema,
    companyUpdateSchema,
    branchCreateSchema,
    branchUpdateSchema
} = require('../../src/schemas/companySchemas');

const {
    userCreateSchema,
    userUpdateSchema,
    userAccessSchema,
    bulkAccessSchema,
    roleCreateSchema
} = require('../../src/schemas/securitySchemas');

describe('CRM, Empresa y Seguridad Schemas Validation', () => {

    // ==========================================
    // CRM SCHEMAS
    // ==========================================
    describe('CRM Schemas', () => {
        it('should validate a correct agreement', () => {
            const validData = {
                customer_name: 'Distribuidora San Miguel S.A.',
                customer_id: 15,
                product_type: 'Huevo Entero Pasteurizado',
                presentation: 'cubeta 30LB',
                agreed_price_per_lb: 1.25,
                monthly_volume_lbs: 3000,
                target_margin_pct: 22.5
            };
            const result = agreementSchema.safeParse(validData);
            assert.strictEqual(result.success, true);
        });

        it('should reject agreement if customer_name is missing or empty', () => {
            const invalidData = {
                customer_name: '   ',
                agreed_price_per_lb: 1.25
            };
            const result = agreementSchema.safeParse(invalidData);
            assert.strictEqual(result.success, false);
            assert.ok(result.error.issues.some(i => i.message.includes('nombre del cliente')));
        });

        it('should validate CRM settings with optional defaults', () => {
            const settings = {
                default_target_margin_pct: 25.0,
                default_payment_terms_days: 15,
                notification_email: 'ventas@empresa.com'
            };
            const result = crmSettingsSchema.safeParse(settings);
            assert.strictEqual(result.success, true);
        });

        it('should validate a quotation with items', () => {
            const quotation = {
                customer_name: 'Restaurante El Buen Sabor',
                validity_days: 30,
                items: [
                    {
                        product_name: 'Huevo Líquido Entero',
                        quantity: 10,
                        unit_price: 32.50,
                        presentation: 'Cubeta 30 lbs'
                    }
                ]
            };
            const result = quotationCreateSchema.safeParse(quotation);
            assert.strictEqual(result.success, true);
        });

        it('should reject quotation without items or with negative price', () => {
            const noItems = {
                customer_name: 'Cliente Sin Items',
                items: []
            };
            const res1 = quotationCreateSchema.safeParse(noItems);
            assert.strictEqual(res1.success, false);

            const negPrice = {
                customer_name: 'Cliente Precio Negativo',
                items: [
                    {
                        product_name: 'Item 1',
                        quantity: 1,
                        unit_price: -5
                    }
                ]
            };
            const res2 = quotationCreateSchema.safeParse(negPrice);
            assert.strictEqual(res2.success, false);
        });

        it('should validate quotation status enum strictly', () => {
            assert.strictEqual(quotationStatusSchema.safeParse({ status: 'aprobada' }).success, true);
            assert.strictEqual(quotationStatusSchema.safeParse({ status: 'rechazada' }).success, true);
            assert.strictEqual(quotationStatusSchema.safeParse({ status: 'invalido_status' }).success, false);
        });

        it('should validate quotation email sending', () => {
            assert.strictEqual(quotationEmailSchema.safeParse({ to: 'cliente@mail.com', subject: 'Cotización' }).success, true);
            assert.strictEqual(quotationEmailSchema.safeParse({ to: '' }).success, false);
        });

        it('should validate user commercial signature', () => {
            const sig = {
                signature_title: 'Gerente Comercial',
                phone: '7777-8888'
            };
            assert.strictEqual(userSignatureSchema.safeParse(sig).success, true);
        });
    });

    // ==========================================
    // EMPRESA SCHEMAS
    // ==========================================
    describe('Empresa y Sucursales Schemas', () => {
        it('should validate company creation with valid NIT/DUI', () => {
            const validCompany = {
                razon_social: 'Avícola Santa Rita S.A. de C.V.',
                nit: '0614-120990-101-2',
                nrc: '123456-7',
                departamento: '06',
                municipio: '14'
            };
            const result = companyCreateSchema.safeParse(validCompany);
            assert.strictEqual(result.success, true);
        });

        it('should validate company partial update', () => {
            const updateData = {
                nombre_comercial: 'Santa Rita Egg Store',
                telefono: '2222-3333'
            };
            const result = companyUpdateSchema.safeParse(updateData);
            assert.strictEqual(result.success, true);
        });

        it('should reject company creation without razon_social', () => {
            const invalidCompany = {
                razon_social: '   ',
                nit: '0614-120990-101-2'
            };
            const result = companyCreateSchema.safeParse(invalidCompany);
            assert.strictEqual(result.success, false);
            assert.ok(result.error.issues.some(i => i.message.includes('razón social')));
        });

        it('should reject company with invalid NIT format', () => {
            const invalidNit = {
                razon_social: 'Empresa Test',
                nit: 'NIT-INVALIDO-123'
            };
            const result = companyCreateSchema.safeParse(invalidNit);
            assert.strictEqual(result.success, false);
            assert.ok(result.error.issues.some(i => i.message.includes('NIT o DUI')));
        });

        it('should validate branch creation and reject missing fields', () => {
            const validBranch = {
                codigo: 'SUC-01',
                nombre: 'Sucursal Central',
                tipo_establecimiento: '01'
            };
            const result = branchCreateSchema.safeParse(validBranch);
            assert.strictEqual(result.success, true);

            const invalidBranch = {
                codigo: '',
                nombre: 'Sucursal'
            };
            const res2 = branchCreateSchema.safeParse(invalidBranch);
            assert.strictEqual(res2.success, false);
        });

        it('should validate branch partial update', () => {
            const updateBranch = {
                nombre: 'Sucursal Renovada'
            };
            const result = branchUpdateSchema.safeParse(updateBranch);
            assert.strictEqual(result.success, true);
        });
    });

    // ==========================================
    // SEGURIDAD SCHEMAS
    // ==========================================
    describe('Seguridad (Usuarios, Accesos, Roles) Schemas', () => {
        it('should validate user creation with correct format', () => {
            const validUser = {
                username: 'jsmith',
                password: 'secretPassword123',
                nombre: 'John Smith',
                email: 'jsmith@example.com',
                telefono: '7890-1234',
                role_id: 2
            };
            const result = userCreateSchema.safeParse(validUser);
            assert.strictEqual(result.success, true);
        });

        it('should reject user creation with short password or invalid phone', () => {
            const shortPass = {
                username: 'jsmith',
                password: '12',
                nombre: 'John Smith'
            };
            assert.strictEqual(userCreateSchema.safeParse(shortPass).success, false);

            const badPhone = {
                username: 'jsmith',
                password: 'password123',
                nombre: 'John Smith',
                telefono: '12345678' // Missing hyphen
            };
            const resPhone = userCreateSchema.safeParse(badPhone);
            assert.strictEqual(resPhone.success, false);
            assert.ok(resPhone.error.issues.some(i => i.message.includes('0000-0000')));
        });

        it('should validate user partial update', () => {
            const update = {
                status: 'inactivo',
                telefono: '7654-3210'
            };
            const result = userUpdateSchema.safeParse(update);
            assert.strictEqual(result.success, true);
        });

        it('should validate user access assignment', () => {
            const access = {
                userId: 5,
                companyId: 1,
                roleId: 2,
                branches: [1, 2]
            };
            const result = userAccessSchema.safeParse(access);
            assert.strictEqual(result.success, true);
        });

        it('should validate bulk access assignment', () => {
            const bulk = {
                userIds: [5, 6],
                assignments: [
                    { companyId: 1, roleId: 2, branches: [1] }
                ]
            };
            const result = bulkAccessSchema.safeParse(bulk);
            assert.strictEqual(result.success, true);

            const emptyBulk = { userIds: [], assignments: [] };
            assert.strictEqual(bulkAccessSchema.safeParse(emptyBulk).success, false);
        });

        it('should validate role creation and reject duplicate permissions', () => {
            const validRole = {
                name: 'Supervisor de Turno',
                permissions: ['view_sales', 'create_sales', 'view_reports'],
                default_dashboard: 'pista'
            };
            const result = roleCreateSchema.safeParse(validRole);
            assert.strictEqual(result.success, true);

            const duplicatePerms = {
                name: 'Role Duplicado',
                permissions: ['view_sales', 'create_sales', 'view_sales']
            };
            const resDup = roleCreateSchema.safeParse(duplicatePerms);
            assert.strictEqual(resDup.success, false);
            assert.ok(resDup.error.issues.some(i => i.message.includes('duplicados')));
        });
    });
});
