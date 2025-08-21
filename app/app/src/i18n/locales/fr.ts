import type { Diff } from '~/i18n/types.d.ts'

import type { DefaultLocaleKeys } from './types.d.ts'

const locale = {
	// Index
	'Online conversion tool for environment files.': 'Outil de conversion en ligne pour les fichiers d\'environnement.',
	// AppForm
	'Convert': 'Convertir',
	'Copy TOTP code': 'Copier le code TOTP',
	'Copy TOTP Secret': 'Copier le secret TOTP',
	'Copy TOTP URI': 'Copier l\'URI TOTP',
	'Failed to create TOTP object': 'Échec de la création de l\'objet TOTP',
	'Fill the form to generate a TOTP code.': 'Remplissez le formulaire pour générer un code TOTP.',
	'Invalid TOTP object type': 'Type d\'objet TOTP invalide',
	'Paste TOTP Secret': 'Coller le secret TOTP',
	'Paste TOTP URI': 'Coller l\'URI TOTP',
	'Reset': 'Réinitialiser',
	'TOTP Algorithm': 'Algorithme TOTP',
	'TOTP Counter': 'Compteur TOTP',
	'TOTP Digits': 'Chiffres TOTP',
	'TOTP Period (seconds)': 'Période TOTP (secondes)',
	'TOTP Remaining Time': 'Temps restant TOTP',
	'TOTP secret is required': 'Le secret TOTP est requis',
	'TOTP Secret': 'Secret TOTP',
	'TOTP URI is required': 'L\'URI TOTP est requise',
	'TOTP URI': 'URI TOTP',
	// Footer
	'Open source project': 'Projet open source',
	'See the source code on': 'Voir le code source sur',
	'Built with': 'Construit avec',
	'served by': 'servi par',
	'Made with love by': 'Créé avec amour par',
	'Data privacy': 'Confidentialité des données',
	'No data is collected or processed over the network or on any server.':
		'Aucune donnée n\'est collectée ou traitée sur le réseau ou sur un serveur.',
	'All data is processed locally in your browser, and stays on your own device.':
		'Toutes les données sont traitées localement dans votre navigateur et restent sur votre propre appareil.',
	'This website uses no cookies and does no tracking.':
		'Ce site web n\'utilise pas de cookies et ne fait pas de suivi.',
} as const

export default locale satisfies
	// Static type check for missing keys
	Readonly<Record<Diff<DefaultLocaleKeys, keyof typeof locale>, string>> &
	// Static type check for extra keys
	Readonly<Record<Diff<keyof typeof locale, DefaultLocaleKeys>, never>>
