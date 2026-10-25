import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      'node_modules/**',
      'uploads/**',
      'data/**',
      'backups/**',
      'drizzle/**',
    ],
  },

  // Código TypeScript (frontend y backend)
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Reglas del React Compiler: se dejan como aviso para no bloquear el CI
      // mientras se migra el código legado a los patrones recomendados.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // La detección de imports/variables sin uso la hace unused-imports (con autofix)
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      // El proyecto usa `any` de forma deliberada en algunas capas legacy.
      // Se irá reduciendo en fases posteriores.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'prefer-const': ['error', { destructuring: 'all' }],
    },
  },

  // Archivos de configuración en JS
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // Service Worker (public/sw.js): usa los globals del contexto service worker.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker, ...globals.browser },
    },
  },

  // Las heurísticas de OCR usan expresiones regulares muy densas: desactivar
  // no-useless-escape evita "correcciones" que alteren patrones deliberados.
  {
    files: ['src/services/plateRecognitionService.ts'],
    rules: {
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
    },
  },

  // Debe ir al final: desactiva reglas que chocan con Prettier
  prettier
);
