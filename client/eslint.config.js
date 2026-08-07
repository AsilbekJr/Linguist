import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * ESLint 9 flat config.
 *
 * Ilgari `npm run lint` umuman ishlamasdi — eslint.config.js yo'q edi va
 * buyruq har safar xato bilan chiqardi. Natijada aniqlanmagan o'zgaruvchiga
 * murojaat (masalan olib tashlangan hook chaqiruvi) build'dan o'tib ketardi
 * va faqat ishga tushganda crash berardi.
 */
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // JSX transform React importini talab qilmaydi
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // O'zbek matni apostrofga to'la ("so'z", "o'rganish") — bu qoida
      // bu loyihada faqat shovqin hosil qiladi va haqiqiy xatolarni ko'mib yuboradi
      'react/no-unescaped-entities': 'off',

      // Aynan shu qoida aniqlanmagan chaqiruvni ushlaydi
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Konfiguratsiya fayllari Node muhitida ishlaydi
    files: ['*.config.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
