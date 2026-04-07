const pool = require('../config/db');

const getSmtpByBranch = async (req, res) => {
    const { branchId } = req.params;
    try {
        // Verificar que la sucursal pertenezca a la empresa del usuario
        const [branchCheck] = await pool.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branchId, req.company_id]
        );

        if (branchCheck.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para acceder a esta sucursal' });
        }

        const [rows] = await pool.query(
            'SELECT * FROM smtp_settings WHERE branch_id = ?',
            [branchId]
        );

        if (rows.length === 0) {
            return res.json(null);
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Error in getSmtpByBranch:', error);
        res.status(500).json({ message: 'Error al obtener configuración SMTP' });
    }
};

const saveSmtp = async (req, res) => {
    const { 
        branch_id, 
        host, 
        port, 
        user, 
        password, 
        encryption, 
        from_email, 
        from_name 
    } = req.body;

    try {
        // Verificar que la sucursal pertenezca a la empresa del usuario
        const [branchCheck] = await pool.query(
            'SELECT id FROM branches WHERE id = ? AND company_id = ?',
            [branch_id, req.company_id]
        );

        if (branchCheck.length === 0) {
            return res.status(403).json({ message: 'No tienes permiso para configurar esta sucursal' });
        }

        // Usar INSERT ... ON DUPLICATE KEY UPDATE para manejar creación/actualización
        const query = `
            INSERT INTO smtp_settings 
            (branch_id, host, port, user, password, encryption, from_email, from_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            host = VALUES(host),
            port = VALUES(port),
            user = VALUES(user),
            password = VALUES(password),
            encryption = VALUES(encryption),
            from_email = VALUES(from_email),
            from_name = VALUES(from_name)
        `;

        await pool.query(query, [
            branch_id, host, port, user, password, encryption, from_email, from_name
        ]);

        res.json({ message: 'Configuración SMTP guardada exitosamente' });
    } catch (error) {
        console.error('Error in saveSmtp:', error);
        res.status(500).json({ message: 'Error al guardar configuración SMTP' });
    }
};

const nodemailer = require('nodemailer');

const testSmtp = async (req, res) => {
    const { 
        host, 
        port, 
        user, 
        password, 
        encryption, 
        from_email, 
        from_name 
    } = req.body;

    try {
        console.log('Testing SMTP connection with:', { host, port, user, encryption, from_email });
        
        // Auto-detect secure based on port if encryption is SSL
        const isSecure = encryption === 'ssl' || parseInt(port) === 465;

        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: isSecure,
            auth: {
                user,
                pass: password
            },
            tls: {
                // do not fail on invalid certs
                rejectUnauthorized: false,
                // for some servers that need specific ciphers
                minVersion: 'TLSv1'
            },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            debug: true,
            logger: true
        });

        // Verificar la conexión
        console.log('Verifying transporter...');
        await transporter.verify();
        console.log('Transporter verified successfully');

        // Enviar correo de prueba
        console.log('Sending test email...');
        const info = await transporter.sendMail({
            from: `"${from_name}" <${from_email}>`,
            to: from_email,
            subject: 'Prueba de Configuración SMTP - Sistema SaaS',
            text: 'Este es un correo de prueba para verificar la configuración de su servidor SMTP.',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #4f46e5;">Prueba Exitosa</h2>
                    <p>Si has recibido este correo, significa que la configuración SMTP del <b>Sistema SaaS</b> funciona correctamente.</p>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">Configuración probada para: <b>${from_name}</b> (${from_email})</p>
                </div>
            `
        });
        console.log('Test email sent:', info.messageId);

        res.json({ message: 'Conexión exitosa. Correo de prueba enviado.' });
    } catch (error) {
        console.error('SMTP TEST ERROR:', error);
        res.status(500).json({ 
            message: 'Error al conectar con el servidor SMTP',
            error: error.message,
            code: error.code,
            command: error.command
        });
    }
};

module.exports = {
    getSmtpByBranch,
    saveSmtp,
    testSmtp
};
