import js from '@eslint/js';
import react from 'eslint-plugin-react';
import globals from 'globals';

export default [
    {
        ignores: [ 'web/**', 'node_modules/**' ],
    },
    js.configs.recommended,
    {
        files: [ 'src/**/*.{js,jsx}' ],
        plugins: {
            react: react,
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat[ 'jsx-runtime' ].rules,
        },
    },
    {
        files: [ 'server.js', 'queues.js', 'vite.config.js', 'eslint.config.js' ],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },
];
