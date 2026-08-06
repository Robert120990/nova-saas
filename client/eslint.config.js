import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
    {
        ignores: ['dist/**', 'node_modules/**', '.vite/**']
    },
    {
        files: ['src/**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: { ...globals.browser },
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
                sourceType: 'module'
            }
        },
        settings: {
            react: { version: '18.3' }
        },
        plugins: {
            react,
            'unused-imports': unusedImports
        },
        rules: {
            ...js.configs.recommended.rules,
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            'react/prop-types': 'off',
            'react/no-unescaped-entities': 'off',
            'no-useless-catch': 'off',
            'unused-imports/no-unused-imports': 'error',
            'unused-imports/no-unused-vars': ['error', {
                vars: 'all',
                varsIgnorePattern: '^_',
                args: 'after-used',
                argsIgnorePattern: '^_',
                caughtErrors: 'none'
            }],
            'no-unused-vars': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }]
        }
    },
    {
        files: ['src/**/*.{js,jsx}'],
        plugins: {
            'react-hooks': reactHooks
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'off'
        }
    },
    {
        files: ['src/**/*.{js,jsx}'],
        plugins: {
            'react-refresh': reactRefresh
        },
        rules: {
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
        }
    },
    {
        files: ['src/context/**/*.{js,jsx}'],
        rules: {
            'react-refresh/only-export-components': 'off'
        }
    },
    {
        files: ['vite.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            globals: { ...globals.node },
            sourceType: 'module'
        },
        rules: {
            ...js.configs.recommended.rules
        }
    }
];
