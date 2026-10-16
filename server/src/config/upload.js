const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = '../../uploads';
        if (file.fieldname === 'certificate') {
            dest = '../../certificados-p12pfx';
        } else if (file.fieldname === 'certificate_crt') {
            dest = '../../certificados-crt';
        }
        cb(null, path.join(__dirname, dest));
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeExt = path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
        cb(null, unique + safeExt);
    }
});

const ALLOWED_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
    '.p12', '.pfx', '.crt', '.pem', '.cer', '.key',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.json'
]);

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return cb(new Error(`Extensión de archivo no permitida: ${ext}`));
        }
        cb(null, true);
    }
});

module.exports = upload;
