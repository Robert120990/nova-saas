const { getVatBookPurchasesPDF } = require('./src/controllers/vatBooks.controller');

// Mock req/res
const req = {
    query: { year: '2024', month: '03', branch_id: 'all' },
    company_id: 1
};
const res = {
    status: (s) => ({ json: (j) => console.log('STATUS:', s, 'JSON:', j), send: (m) => console.log('STATUS:', s, 'SEND:', m) }),
    setHeader: (k, v) => console.log('HEADER:', k, v)
};

// Mock pool.query if needed, but the controller uses require('../config/db')
// I'll just run it and see if it crashes on synchronous code (PDFKit, etc)
getVatBookPurchasesPDF(req, res).catch(e => console.error('CRASHED:', e));
