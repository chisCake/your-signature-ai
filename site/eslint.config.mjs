import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // React specific rules
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'warn',

      // General rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-debugger': 'error',

      // Console rules - более детальный контроль
      'no-console': 'off',
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            'CallExpression[callee.object.name="console"][callee.property.name="log"]',
          message:
            'console.log is not allowed. Use console.error for errors or remove for production.',
        },
      ],

      // Import rules - запрет всех относительных импортов
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../**', '../../**', '../../../**', '../../../../**'],
              message:
                'Relative imports are not allowed. Use absolute imports with @/ alias instead.',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
