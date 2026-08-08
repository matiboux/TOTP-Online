import type { DefaultLocale } from '~/i18n/types.d.ts'

export const localeKeys = [
	// Index
	'Online conversion tool for environment files.',
	// AppForm
	'Convert',
	'Copy TOTP code',
	'Copy TOTP Secret',
	'Copy TOTP URI',
	'Failed to create TOTP object',
	'Fill the form to generate a TOTP code.',
	'Invalid TOTP object type',
	'Paste TOTP Secret',
	'Paste TOTP URI',
	'Reset',
	'TOTP Algorithm',
	'TOTP Counter',
	'TOTP Digits',
	'TOTP Period (seconds)',
	'TOTP Remaining Time',
	'TOTP secret is required',
	'TOTP Secret',
	'TOTP URI is required',
	'TOTP URI',
	// Footer
	'Open source project',
	'See the source code on',
	'Built with',
	'served by',
	'Made with love by',
	'Data privacy',
	'No data is collected or processed over the network or on any server.',
	'All data is processed locally in your browser, and stays on your own device.',
	'This website uses no cookies and does no tracking.',
] as const satisfies DefaultLocale

export type DefaultLocaleConst = typeof localeKeys
