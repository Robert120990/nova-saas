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
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

module.exports = upload;
