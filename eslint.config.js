import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import esX from 'eslint-plugin-es-x';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off',
			// Only matters for apps served below a base path, which this one isn't.
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			// Type information lets es-x tell iterator methods (e.g. `map.entries().map`) from array methods. The
			// options must equal the Svelte files' ones, or the project service is rebuilt over and over (minutes).
			parserOptions: { projectService: true, extraFileExtensions: ['.svelte'] }
		}
	},
	{
		// Browser support: the app has to run on iOS/Safari 17.4, the first to have `Map.groupBy` (ES2024), which the
		// code relies on. Newer built-ins aren't transpiled or polyfilled by the build and break the page's script
		// there, e.g. iterator helpers (`map.entries().map(…)`, Safari 18.4). Spread into an array instead.
		files: ['src/**/*.{ts,js,svelte}'],
		...esX.configs['flat/restrict-to-es2024'],
		rules: {
			...esX.configs['flat/restrict-to-es2024'].rules,
			// ES2025, but in Safari since 17.0.
			'es-x/no-regexp-duplicate-named-capturing-groups': 'off',
			'es-x/no-set-prototype-difference': 'off',
			'es-x/no-set-prototype-intersection': 'off',
			'es-x/no-set-prototype-isdisjointfrom': 'off',
			'es-x/no-set-prototype-issubsetof': 'off',
			'es-x/no-set-prototype-issupersetof': 'off',
			'es-x/no-set-prototype-symmetricdifference': 'off',
			'es-x/no-set-prototype-union': 'off'
		}
	}
);
