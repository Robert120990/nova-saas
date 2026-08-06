const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'logs/**',
            'scratch/**',
            'tmp/**',
            'uploads/**',
            'certificados-p12pfx/**',
            'certificados-crt/**',
            '*.log',
            '*.txt',
            'last_retransmit.json'
        ]
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: { ...globals.node },
            sourceType: 'commonjs'
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': 'warn',
            'no-useless-catch': 'off',
            'no-async-promise-executor': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    }
];
