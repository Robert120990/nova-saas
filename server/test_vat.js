const pool = require('./src/config/db');
const { getVatBookPurchasesPDF } = require('./src/controllers/vatBooks.controller');

async function test() {
    const req = {
        query: { year: '2024', month: '03', branch_id: 'all' },
        user: { company_id: 1 },
        company_id: 1
    };
    const res = {
        status: (s) => ({
            json: (j) => console.log('STATUS:', s, 'JSON:', JSON.stringify(j, null, 2)),
            send: (m) => console.log('STATUS:', s, 'SEND:', m.length, 'bytes')
        }),
        setHeader: (k, v) => console.log('HEADER:', k, v),
        send: (b) => console.log('SEND BUFFER:', b.length, 'bytes')
    };

    try {
        await getVatBookPurchasesPDF(req, res);
    } catch (e) {
        console.error('TEST CRASHED:', e);
    } finally {
        process.exit();
    }
}

test();
