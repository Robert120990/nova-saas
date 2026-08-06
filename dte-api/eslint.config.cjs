const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'logs/**',
            'scratch/**',
            'docs/**',
            '*.log',
            '*.txt',
            '*.json'
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
            'no-unused-vars': 'warn'
        }
    }
];
