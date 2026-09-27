const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load, database, controller, invoke } = require('./eggTestHelpers.cjs');
const rules = require('../../src/services/eggRules.service');
const stock = require('../../src/services/eggStock.service');
const write = () => [{ affectedRows: 1, insertId: 123 }];

test('Eliminar con force no devuelve MP de un lote ya procesado', async () => {
    const db = database(() => [[{ id: 1, status: 'pasteurizado', completed_at: '2026-09-26' }]]);
    const result = await invoke(controller('eggProduction', db).deleteProductionBatch, { params: { id: 1 }, query: { force: 'true' } });
    assert.equal(result.statusCode, 409);
    assert(!db.calls.some(call => /^(UPDATE|DELETE|INSERT)/.test(call.sql)));
});

test('Análisis incompleto guarda resultados desconocidos y actor real, sin liberar', async () => {
    let saved;
    const db = database((sql, params) => {
        if (sql.startsWith('SELECT')) return [[{ id: 1, status: 'en_proceso' }]];
        if (sql.includes('INSERT INTO egg_lab_micro_logs')) saved = params;
        return write();
    });
    const result = await invoke(controller('eggQualityLab', db).createLabLog, { body: { batch_id: 1 } });
    assert.equal(result.statusCode, 201);
    assert.equal(result.body.release_status, 'cuarentena');
    assert.equal(saved[10], null);
    assert.equal(saved[12], null);
    assert.equal(saved[29], 'Pruebas');
});

test('Conciliación aceptada registra pago una vez y repetir no reemite ni duplica', async () => {
    const job = { id: 3, status: 'review', payload_json: { header: { condicion_operacion: 1 }, payments: [{ codigo: '01', monto: 25 }] } };
    let payments = 0;
    const db = database((sql, params) => {
        if (sql.includes('SELECT * FROM egg_dispatch_emissions')) return [[job]];
        if (sql.includes('SELECT * FROM dtes')) return [[{ status: 'ACCEPTED', sello_recepcion: 'SELLO', codigo_generacion: 'ABC', numero_control: 'DTE-01' }]];
        if (sql.includes("SET status = 'accepted'")) { job.status = 'accepted'; job.result_json = params[0]; }
        if (sql.includes('SELECT sale_id FROM sales_payments')) return [[]];
        if (sql.includes('INSERT INTO sales_payments')) payments++;
        return write();
    });
    const recovery = load('src/services/eggDispatchRecovery.service.js', { 'src/config/db.js': db });
    assert.equal((await recovery.reconcileEmission(7, 22)).success, true);
    assert.equal((await recovery.reconcileEmission(7, 22)).success, true);
    assert.equal(payments, 1);
});

test('WebSocket rechaza sesión ausente y usa la empresa validada para el handshake', async () => {
    const { EventEmitter } = require('node:events');
    let upgrade, upgraded = 0;
    class FakeServer extends EventEmitter {
        handleUpgrade() { upgraded++; }
    }
    const service = load('src/services/websocket.service.js', {
        ws: { Server: FakeServer }, jsonwebtoken: { verify: token => { assert.equal(token, 'valid'); return { id: 9 }; } },
        'src/services/eggAccess.service.js': {
            async getAccess(user, company) { assert.equal(user.id, 9); assert.equal(company, 7); return {}; },
            hasPermission: () => true
        }
    });
    service.initWebSocket({ on(event, handler) { assert.equal(event, 'upgrade'); upgrade = handler; } });
    let rejected = 0;
    const socket = { write() { rejected++; }, destroy() {} };
    await upgrade({ url: '/ws/egg-industrial?company_id=7', headers: { host: 'localhost' } }, socket);
    assert.equal(rejected, 1); assert.equal(upgraded, 0);
    await upgrade({ url: '/ws/egg-industrial?company_id=7', headers: { host: 'localhost', 'sec-websocket-protocol': 'sipe, auth.valid' } }, socket);
    assert.equal(upgraded, 1);
});

test('MP agrupa duplicados antes de comprobar saldo y rechaza pesos o cajas inválidos', () => {
    const rows = rules.normalizeMaterials([{raw_material_id: 4,quantity_lbs: 60,boxes_count: 2},{raw_material_id:4,quantity_lbs:50,boxes_count:3}]);
    assert.equal(rows.length,1); assert.equal(rows[0].quantity_lbs,110); assert.equal(rows[0].boxes_count,5);
    for(const quantity_lbs of [-1,NaN,Infinity,'',null]) assert.throws(() => rules.normalizeMaterials([{raw_material_id:4,quantity_lbs}]), /inválido/);
    assert.throws(() => rules.normalizeMaterials([{raw_material_id:4,quantity_lbs:3,boxes_count:1.5}]), /enteras/);
});
test('Perfil desconocido no supera HACCP y temperaturas no numéricas son inválidas', () => {
    assert.equal(rules.evaluatePasteurization('clara ppg',0,200).compliant,false);
    assert.equal(rules.evaluatePasteurization('clara',56.5,200).compliant,true);
    assert.equal(rules.evaluatePasteurization('huevo entero',63,200).compliant,false);
    assert.equal(rules.evaluatePasteurization('clara, yema',60,200).compliant,false);
    assert.throws(() => rules.evaluatePasteurization('clara','',200));
});
const completeLab = { fq_status:'aprobado', mb_status:'aprobado', ph:7,brix:12,solids_percentage:20,mesophilic_aerobic_cfu:0,total_coliforms_mpn:0,e_coli_mpn:0,fungi_yeasts_cfu:0,salmonella_25g:'ausencia',staph_aureus:'negativo' };
test('Liberación exige resultados completos, ambos dictámenes y ausencia de rechazo', () => {
    assert.equal(rules.evaluateLab(completeLab).release,'liberado');
    assert.equal(rules.evaluateLab({...completeLab,fq_status:'rechazado'}).release,'bloqueado_haccp');
    assert.equal(rules.evaluateLab({...completeLab,ph:null}).release,'cuarentena');
    assert.equal(rules.evaluateLab({mb_status:'aprobado',fq_status:'aprobado'}).release,'cuarentena');
    assert.equal(rules.evaluateLab({...completeLab,salmonella_25g:'presencia'}).release,'bloqueado_haccp');
});
test('Referencias ajenas se rechazan y la consulta siempre incluye empresa', async () => {
    const db=database((sql,params)=>{assert.match(sql,/company_id = \?/);assert.equal(params[1],7);return [[]];});
    await assert.rejects(rules.owned(db,'egg_raw_materials',8,7,true),{status:404});
    await assert.rejects(rules.owned(db,'users',1,7),{status:400});
});
function stockDb(pkgOverrides={}) {return database(sql=>sql.includes('SELECT expiry')?[[{valid:1}]]:sql.includes('SELECT pk.')?[[{id:1,units_packaged:10,total_batch_weight_lbs:300,dispatched_units:3,dispatched_weight_lbs:90,weight_per_unit_lbs:30,product_type:'huevo entero',quality_status:'liberado',batch_status:'aprobado_calidad',...pkgOverrides}]]:write());}
test('Despacho valida saldo acumulado de partidas repetidas, unidades y calidad', async () => {
    const item={packaging_id:1,quantity_lbs:120,units:4,product_type:'huevo entero'};
    await assert.rejects(stock.reserveItems(stockDb(),7,[item,item]), /Existencias/);
    await assert.rejects(stock.reserveItems(stockDb({quality_status:'cuarentena'}),7,[item]), /liberado/);
    await assert.rejects(stock.reserveItems(stockDb({batch_status:'bloqueado_haccp'}),7,[item]), /liberado/);
    await assert.rejects(stock.reserveItems(stockDb(),7,[{...item,units:3}]), /corresponden/);
    assert.equal((await stock.reserveItems(stockDb(),7,[item]))[0].pounds,120);
});
test('Despacho conserva producido y repetir movimiento no vuelve a descontar', async () => {
    let exists=false,updates=0;
    const db=database(sql=>{if(sql.startsWith('SELECT id'))return [exists?[{id:1}]:[]];if(sql.startsWith('UPDATE')){updates++;assert.doesNotMatch(sql,/SET units_packaged|SET total_batch_weight_lbs/);}if(sql.startsWith('INSERT'))exists=true;return write();});
    const selection=[{pkg:{id:1},units:2,pounds:60}];
    await stock.recordDispatch(db,7,11,selection);await stock.recordDispatch(db,7,11,selection);assert.equal(updates,1);
});
test('Finalización física no aprueba calidad y se confirma junto a su evento', async () => {
    const db=database(sql=>sql.includes('SELECT * FROM egg_production_batches')?[[{id:1,status:'en_proceso',input_weight_lbs:100}]]:sql.includes('SELECT COALESCE')?[[{lbs:0}]]:write());
    const result=await invoke(controller('eggProduction',db).completeProductionBatch,{params:{id:1},body:{yield_liquid_lbs:80,waste_shell_lbs:20,waste_loss_lbs:0}});
    assert.equal(result.statusCode,200);assert.equal(result.body.status,'en_proceso');assert(db.calls.some(c=>c.sql==='COMMIT'));
});
test('Cierre de empaque bloqueado se rechaza y cierre repetido no duplica merma', async () => {
    for(const batch of [{status:'bloqueado_haccp'},{status:'empaquetado',packaging_status:'cerrado'}]){
        const db=database(sql=>sql.startsWith('SELECT')?[[{id:1,...batch}]]:write());
        const result=await invoke(controller('eggPackaging',db).closeBatchPackaging,{params:{id:1}});
        assert.equal(result.statusCode,batch.status==='bloqueado_haccp'?409:200);
        assert(!db.calls.some(c=>c.sql.includes('INSERT INTO egg_batch_wastes')));
    }
});
test('Editar remanente ajeno o asignado no cambia destino', async () => {
    const db=database(()=>[[{id:1,target_batch_id:42,status:'asignado_a_lote'}]]);
    const r=await invoke(controller('eggProduction',db).updateBatchRemanente,{params:{id:1},body:{target_batch_id:55,status:'disponible'}});
    assert.equal(r.statusCode,409);assert(!db.calls.some(c=>c.sql.startsWith('UPDATE')));
});
test('Reportes aceptan filtros de pantalla y entregan data además de rows', async () => {
    let filters;const service={async getRawMaterialsReportData(company,f){assert.equal(company,7);filters=f;return{rows:[{id:1}],summary:{}};}};
    const r=await invoke(controller('eggReports',database(write),{eggReportsExportService:service}).getRawMaterialsReport,{query:{from:'2026-09-01',to:'2026-09-26'}});
    assert.equal(filters.startDate,'2026-09-01');assert.equal(filters.endDate,'2026-09-26');assert.equal(r.body.data.length,1);
});
test('Pronóstico sin datos no fabrica historial ni porcentaje de confianza', async () => {
    const r=await invoke(controller('eggPlanning',database(()=>[[]])).getForecasting);
    assert.equal(r.body.status,'insufficient_data');assert.equal(r.body.forecast,null);assert.equal(r.body.confidence_interval,null);assert.equal(r.body.historical.length,0);
});
test('Permisos usan el rol asignado en la empresa y no un nombre Admin', async () => {
    const db=database((sql,params)=>{assert.match(sql,/ue.role_id/);assert.deepEqual([...params],[9,7]);return [[{permissions:JSON.stringify(['manage_egg_quality'])}]];});
    const access=load('src/services/eggAccess.service.js',{'src/config/db.js':db});
    const result=await access.getAccess({id:9,role:'Admin'},7);
    assert(access.hasPermission(result,'manage_egg_quality'));assert(!access.hasPermission(result,'manage_egg_dispatch'));
});
test('Simulación de una empresa no modifica otra', () => {
    const telemetry=load('src/services/eggTelemetry.service.js');telemetry.command(7,'control_pasteurizer',{active:true});
    assert.equal(telemetry.stateFor(7).pasteurizer.active,true);assert.equal(telemetry.stateFor(8).pasteurizer.active,false);assert.equal(telemetry.stateFor(7).is_simulation,true);
});
test('DTE rechazado queda borrador, llamada externa ocurre sin transacción y no se reemite', async () => {
    let state='pending',emissions=0;
    const db=database((sql,params)=>{
        if(sql.includes('SELECT * FROM egg_dispatch_emissions'))return [[{id:3,status:state,payload_json:{header:{}}}]];
        if(sql.includes('SELECT * FROM companies'))return [[{id:7}]];
        if(sql.includes("SET status = 'sending'"))state='sending';
        if(sql.includes('UPDATE sales_headers'))assert.equal(params[0],'borrador');
        if(sql.includes('SET status = ?'))state=params[0];return write();
    });
    const service=load('src/services/eggDispatchEmission.service.js',{'src/config/db.js':db,'src/services/dte.service.js':{async emitDTE(){assert.equal(db.transaction,false);emissions++;return {success:false,codigo_generacion:'ABC',error:'Rechazo de prueba'};}}});
    const result=await service.emitSavedSale(7,22);assert.equal(result.success,false);assert.equal(state,'review');
    await assert.rejects(service.emitSavedSale(7,22), /conciliación/);assert.equal(emissions,1);
});
test('Conciliación no marca emitido si Gestión DTE no confirma aceptación', async () => {
    const db=database(sql=>sql.includes('egg_dispatch_emissions')?[[{id:3,status:'review'}]]:sql.includes('FROM dtes')?[[{status:'REJECTED',codigo_generacion:'ABC'}]]:write());
    const recovery=load('src/services/eggDispatchRecovery.service.js',{'src/config/db.js':db});
    await assert.rejects(recovery.reconcileEmission(7,22), /Gestión DTE/);assert(!db.calls.some(c=>c.sql.startsWith('UPDATE')));
});
test('Retornables registra todas las partidas en una sola venta e ignora reintento', async () => {
    let exists=false,delivered=0;const db=database((sql,params)=>{if(sql.includes('SELECT id, nombre FROM customers'))return [[{id:9,nombre:'Prueba'}]];if(sql.includes('SELECT id FROM egg_returnable_movements'))return[exists?[{id:1}]:[]];if(sql.includes('SELECT id FROM egg_returnable_packaging'))return [[{id:9}]];if(sql.includes('INSERT INTO egg_returnable_movements')){exists=true;delivered=params[3];}return write();});
    const service=load('src/services/eggReturnableService.js',{'src/config/db.js':db});const sale={company_id:7,customer_id:9,customer_name:'Prueba',sale_id:22,items:[{is_returnable:true,returnable_units:10,descripcion:'Clara cubeta 30 LB'},{is_returnable:true,returnable_units:20,descripcion:'Clara cubeta 32 LB'}]};
    await service.recordSaleReturnables({...db},sale);await service.recordSaleReturnables({...db},sale);assert.equal(delivered,30);assert.equal(db.calls.filter(c=>c.sql.includes('INSERT INTO egg_returnable_movements')).length,1);
});

test('Router conserva todos los handlers y cada endpoint tiene permiso explícito', () => {
    const endpoints=[];const router={use(){}};
    for(const method of ['get','post','put','delete','patch']) router[method]=(path,...handlers)=>{assert.equal(handlers.length,2,`${method} ${path}`);for(const fn of handlers)assert.equal(typeof fn,'function',`${method} ${path}`);endpoints.push({method,path});};
    load('src/routes/eggIndustrial.routes.js',{'src/config/db.js':database(write),'express':{Router:()=>router},'src/controllers/eggIndustrial/eggUtils.js':{pool:database(write)}});
    assert(endpoints.length>=186);assert(endpoints.some(e=>e.path==='/inventory-translated/export'));assert(endpoints.some(e=>e.path==='/dispatch/emissions/:saleId/recover'));
});
test('Rendimiento no duplica líquido y empaque y usa tres consultas por reporte', async () => {
    const db=database(sql=>{
        if(sql.includes('FROM egg_production_batches'))return [[{id:1,input_weight_lbs:100,yield_liquid_lbs:80}]];
        if(sql.includes('FROM egg_packaging_records'))return [[{batch_id:1,packaged_weight:80}]];
        if(sql.includes('FROM batch_raw_materials'))return [[{batch_id:1,quantity_lbs:100,boxes_count:5}]];
        throw Error(sql);
    });
    const service=load('src/services/eggReportsExport.service.js',{'src/config/db.js':db});const report=await service.getProductionReportData(7,{});
    assert.equal(report.rows[0].liquid_plus_packaged_lbs,80);assert.equal(report.rows[0].yield_pct,80);assert.equal(db.calls.length,3);
});
test('Comisión mensual no se duplica en otra quincena ni recalcula una transferida', async () => {
    for(const previous of [{quincena:'primera',status:'borrador'},{quincena:'segunda',status:'transferido_planilla'}]){
        const db=database(sql=>sql.includes('FROM sellers s')?[[{seller_id:1}]]:sql.includes('SELECT * FROM egg_seller_commissions')?[[previous]]:write());
        const c=load('src/controllers/eggCommissions.controller.js',{'src/config/db.js':db});
        const r=await invoke(c.calculatePeriodCommissions,{body:{year:2026,month:9,quincena:'segunda'}});
        assert.equal(r.statusCode,previous.quincena==='primera'?409:200);
        assert(!db.calls.some(c=>c.sql.includes('INSERT INTO egg_seller_commissions')));
    }
});
test('Recepción nueva ignora aprobación enviada por el cliente', async () => {
    let saved;
    const db=database((sql,params)=>{ if(sql.startsWith('SELECT'))return [[{id:1}]];if(sql.includes('INSERT INTO egg_raw_materials'))saved=params;return write(); });
    const r=await invoke(controller('eggReception',db).createRawMaterial,{body:{provider_id:1,branch_id:1,weight_lbs:100,total_boxes:5,status:'aprobado'}});
    assert.equal(r.statusCode,201);assert.equal(saved[19],'pendiente_aprobacion');
});

test('Migración conserva saldo disponible y repetirla no duplica despachos históricos', async () => {
    let migrated=false, produced=7, dispatched=null, ledger=0, roles=[];
    const db=database((sql,params)=>{
        if(sql==='SHOW COLUMNS FROM egg_packaging_records')return [[{Field:'dispatched_units'},{Field:'dispatched_weight_lbs'}]];
        if(sql.includes('SELECT id, company_id FROM egg_packaging_records'))return [migrated?[]:[{id:4,company_id:7}]];
        if(sql.includes('SELECT dispatched_units'))return [[{dispatched_units:dispatched}]];
        if(sql.includes('SELECT payload'))return [[{payload:{sale_id:22,units_deducted:3,lbs_deducted:90}}]];
        if(sql.includes('INSERT IGNORE INTO egg_packaging_movements'))ledger++;
        if(sql.includes('SET units_packaged = units_packaged +')){produced+=params[0];dispatched=params[2];migrated=true;}
        if(sql.includes('SELECT id FROM menu_items'))return [[{id:1}]];
        if(sql.includes('SELECT id, name, permissions FROM roles'))return [[{id:2,name:'Supervisor',permissions:JSON.stringify(['manage_traceability'])}]];
        if(sql.includes('UPDATE roles SET permissions'))roles=JSON.parse(params[0]);
        return write();
    });
    const migration=load('../database/migration_v234_egg_integrity.js',{'../database/migration_v234_egg_legacy_schema.js':{ensureLegacyEggSchema:async()=>{}}});
    await migration.migrate(db);await migration.migrate(db);
    assert.equal(produced,10);assert.equal(produced-dispatched,7);assert.equal(ledger,1);assert(roles.includes('manage_egg_quality'));
});
