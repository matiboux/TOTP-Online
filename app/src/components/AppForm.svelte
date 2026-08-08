<script lang="ts">
import { onMount, onDestroy } from 'svelte'
import { persistentAtom } from '@nanostores/persistent'
import * as OTPAuth from 'otpauth'

// Props
let wrapperClass: string | undefined = undefined
let wrapperStyle: string | undefined = undefined
let locale: string | undefined = undefined
export {
	wrapperClass as class,
	wrapperStyle as style,
	locale,
}

import { i18nFactory } from '~/i18n'
const _ = i18nFactory(locale as any)

const progressDiscRadius = 20
const progressDiscCircumference = 2 * Math.PI * progressDiscRadius

const totpAlgorithms = [
	'SHA1',
	'SHA224',
	'SHA256',
	'SHA384',
	'SHA512',
	'SHA3-224',
	'SHA3-256',
	'SHA3-384',
	'SHA3-512',
] as const

type TotpAlgorithm = typeof totpAlgorithms[number]

interface TotpConfig
{
	uri: string
	algorithm: TotpAlgorithm
	digits: number
	period: number
	secret: string
}

type TotpPersistentConfig = Pick<TotpConfig, 'algorithm' | 'digits' | 'period'>

const defaultTotpConfig: TotpConfig = {
	uri: '',
	algorithm: 'SHA1', // HMAC algorithm
	digits: 6, // Token length in digits
	period: 30, // Token validity period in seconds
	secret: '',
}

const totpConfig: TotpConfig = {
	uri: defaultTotpConfig.uri,
	algorithm: defaultTotpConfig.algorithm,
	digits: defaultTotpConfig.digits,
	period: defaultTotpConfig.period,
	secret: defaultTotpConfig.secret,
}

let totpEffectiveConfig: TotpConfig | null = null

let lastCalledMethod: 'computeTotpUri' | 'generate' | null = null

const totpPersistentConfig = persistentAtom<string>('totpPersistentConfig', undefined)

let errorMessage: string | null = null

let totp: OTPAuth.TOTP | null = null
let totpCode: string = ''
let totpCounter: number = 0
let totpRemaining: number = 0

let totpUriCopied: boolean = false
let totpSecretCopied: boolean = false
let totpCodeCopied: boolean = false

// Add interval id for periodic updates
let totpRefreshId: ReturnType<typeof setTimeout> | undefined = undefined

onMount(() =>
{
	totpPersistentConfig.subscribe(onSubcribeTotpPersistentConfig)
})

onDestroy(() =>
{
	// Clear the TOTP generation refresh interval
	clearRefreshTotp()
})

function onSubcribeTotpPersistentConfig(newValue: string)
{
	let config: TotpPersistentConfig | null = null

	try
	{
		config = JSON.parse(newValue)
	}
	catch
	{
		config = null
	}

	totpConfig.algorithm = config?.algorithm ?? defaultTotpConfig.algorithm
	totpConfig.digits = config?.digits ?? defaultTotpConfig.digits
	totpConfig.period = config?.period ?? defaultTotpConfig.period

	// Only read once to restore the TOTP configuration, then unsubscribe
	totpPersistentConfig.off()
}

function onChangeTotpUri()
{
	totpUriCopied = false
	saveConfig()
	generate()
}

function onChangeTotpAlgorithm()
{
	saveConfig()
	computeTotpUri()
}

function onChangeTotpDigits()
{
	if (!Number.isFinite(totpConfig.digits) || totpConfig.digits < 1)
	{
		// Ensure digits is a positive finite number
		totpConfig.digits = 1
	}

	saveConfig()
	computeTotpUri()
}

function onChangeTotpPeriod()
{
	if (!Number.isFinite(totpConfig.period) || totpConfig.period < 1)
	{
		// Ensure period is a positive finite number
		totpConfig.period = 1
	}

	saveConfig()
	computeTotpUri()
}

function onChangeTotpSecret()
{
	totpSecretCopied = false
	saveConfig()
	computeTotpUri()
}

function saveConfig()
{
	const config: TotpPersistentConfig = {
		algorithm: totpConfig.algorithm,
		digits: totpConfig.digits,
		period: totpConfig.period,
	}

	totpPersistentConfig.set(JSON.stringify(config))
}

function computeTotpUri()
{
	lastCalledMethod = 'computeTotpUri'

	if (!totpConfig.secret)
	{
		errorMessage = _('TOTP secret is required')
		resetTotpOutput()
		return
	}

	if (
		totpEffectiveConfig &&
		totpConfig.algorithm === totpEffectiveConfig.algorithm &&
		totpConfig.digits === totpEffectiveConfig.digits &&
		totpConfig.period === totpEffectiveConfig.period &&
		totpConfig.secret === totpEffectiveConfig.secret
	)
	{
		// No TOTP configuration change, nothing to do
		return
	}

	let totpObject: OTPAuth.TOTP | null = null

	try
	{
		totpObject = new OTPAuth.TOTP({
			algorithm: totpConfig.algorithm ?? defaultTotpConfig.algorithm,
			digits: totpConfig.digits ?? defaultTotpConfig.digits,
			period: totpConfig.period ?? defaultTotpConfig.period,
			secret: totpConfig.secret,
		})
	}
	catch (error: unknown)
	{
		console.error('Failed to create TOTP object:', error)
		totpObject = null
	}

	if (!totpObject)
	{
		errorMessage = _('Failed to create TOTP object')
		resetTotpOutput()
		return
	}

	// Save the effective TOTP configuration
	totpEffectiveConfig = Object.assign({}, totpConfig)

	// Update the TOTP URI
	// totpUri.set(totp.toString())
	totpConfig.uri = totpObject.toString()
	generate(false)
}

function generate(updateConfig: boolean = true)
{
	if (updateConfig)
	{
		lastCalledMethod = 'generate'
	}

	if (!totpConfig.uri)
	{
		errorMessage = _('TOTP URI is required')
		resetTotpOutput()
		return
	}

	if (
		totpEffectiveConfig &&
		totpConfig.uri === totpEffectiveConfig.uri
	)
	{
		// No TOTP configuration change, nothing to do
		return
	}

	let totpObject: OTPAuth.HOTP | OTPAuth.TOTP | null = null

	try
	{
		totpObject = OTPAuth.URI.parse(totpConfig.uri)
	}
	catch (error: unknown)
	{
		console.error('Failed to create TOTP object:', error)
		totpObject = null
	}

	if (!totpObject)
	{
		errorMessage = _('Failed to create TOTP object')
		resetTotpOutput()
		return
	}

	if (!(totpObject instanceof OTPAuth.TOTP))
	{
		errorMessage = _('Invalid TOTP object type')
		resetTotpOutput()
		return
	}

	totp = totpObject

	if (updateConfig)
	{
		// Update the TOTP configuration elements
		totpConfig.algorithm = totp.algorithm as TotpAlgorithm
		totpConfig.digits = totp.digits
		totpConfig.period = totp.period
		totpConfig.secret = totp.secret.base32
		saveConfig()
	}

	// Save the effective TOTP configuration
	totpEffectiveConfig = Object.assign({}, totpConfig)

	// Reset TOTP output
	errorMessage = null
	resetTotpOutput()

	// Create the TOTP generation refresh interval
	clearRefreshTotp()
	totpRefreshId = setInterval(refreshTotp, 100)
}

function clearRefreshTotp()
{
	// Clear the TOTP generation refresh interval
	if (totpRefreshId !== undefined)
	{
		clearInterval(totpRefreshId)
		totpRefreshId = undefined
	}
}

function refreshTotp()
{
	if (!totp)
	{
		clearInterval(totpRefreshId)
		totpRefreshId = undefined
		return
	}

	// Update the TOTP remaining time
	totpRemaining = totp.remaining() // milliseconds

	// Regenerate the TOTP code only if the counter has changed
	const newCounter = totp.counter()
	if (newCounter !== totpCounter)
	{
		totpCode = totp.generate()
		totpCodeCopied = false
		totpCounter = newCounter
	}
}

function onCopyTotpUri()
{
	const clipboard = window.navigator.clipboard

	if (!clipboard || !clipboard.writeText)
	{
		console.warn('Clipboard API not supported')
	}

	// Copy the TOTP URI to the clipboard
	clipboard.writeText(totpConfig.uri)
		.then(() => {
			totpUriCopied = true
			totpSecretCopied = false
			totpCodeCopied = false
		})
		.catch((error: Error) => {
			console.error('Failed to copy TOTP URI', error)
		})
}

function onCopyTotpSecret()
{
	const clipboard = window.navigator.clipboard

	if (!clipboard || !clipboard.writeText)
	{
		console.warn('Clipboard API not supported')
	}

	// Copy the TOTP secret to the clipboard
	clipboard.writeText(totpConfig.secret)
		.then(() => {
			totpUriCopied = false
			totpSecretCopied = true
			totpCodeCopied = false
		})
		.catch((error: Error) => {
			console.error('Failed to copy TOTP secret', error)
		})
}

function onCopyTotpCode()
{
	if (!totpCode)
	{
		return
	}

	const clipboard = window.navigator.clipboard

	if (!clipboard || !clipboard.writeText)
	{
		console.warn('Clipboard API not supported')
	}

	// Copy the TOTP code to the clipboard
	clipboard.writeText(totpCode)
		.then(() => {
			totpUriCopied = false
			totpSecretCopied = false
			totpCodeCopied = true
		})
		.catch((error: Error) => {
			console.error('Failed to copy TOTP code', error)
		})
}

function onPasteTotpUri()
{
	const clipboard = window.navigator.clipboard

	if (!clipboard || !clipboard.readText)
	{
		console.warn('Clipboard API not supported')
	}

	// Read the TOTP URI from the clipboard
	navigator.clipboard.readText()
		.then((text) => {
			totpConfig.uri = text
			saveConfig()
			generate()
		})
		.catch((error: Error) => {
			console.error('Failed to paste TOTP URI', error)
		})
}

function onPasteTotpSecret()
{
	const clipboard = window.navigator.clipboard

	if (!clipboard || !clipboard.readText)
	{
		console.warn('Clipboard API not supported')
	}

	// Read the TOTP secret from the clipboard
	navigator.clipboard.readText()
		.then((text) => {
			totpConfig.secret = text
			saveConfig()
			computeTotpUri()
		})
		.catch((error: Error) => {
			console.error('Failed to paste TOTP URI', error)
		})
}

function onSubmit()
{
	if (lastCalledMethod === 'generate')
	{
		generate()
		return
	}

	computeTotpUri()
}

function onReset()
{
	// Reset TOTP configuration
	resetTotpConfig()

	// Reset TOTP output
	errorMessage = null
	resetTotpOutput()
}

function resetTotpConfig()
{
	// Reset TOTP configuration to default values
	totpConfig.uri = defaultTotpConfig.uri
	totpConfig.algorithm = defaultTotpConfig.algorithm
	totpConfig.digits = defaultTotpConfig.digits
	totpConfig.period = defaultTotpConfig.period
	totpConfig.secret = defaultTotpConfig.secret

	// Save the reset configuration
	saveConfig()
}

function resetTotpOutput()
{
	// Reset TOTP output
	totpCode = ''
	totpCodeCopied = false
	totpCounter = 0
	totpRemaining = 0

	// Clear the TOTP generation refresh interval
	clearRefreshTotp()
}
</script>

<div
	class={[ wrapperClass ].join(' ')}
	style={wrapperStyle}
>

	<form class="form">

		<div class="form-group">
			<label>
				<div class="label">
					{_('TOTP URI')}
				</div>
				<div class="form-input-group">
					<button
						class="form-input-button"
						aria-label={_('Paste TOTP URI')}
						on:click|preventDefault={onPasteTotpUri}
					>
						<span class="icon-[mdi--clipboard-arrow-right] icon-align"></span>
					</button>
					<input
						type="text"
						class="form-input"
						placeholder="otpauth://totp/..."
						bind:value={totpConfig.uri}
						on:input|preventDefault={onChangeTotpUri}
						on:change|preventDefault={onChangeTotpUri}
					/>
					<button
						class="form-input-button"
						aria-label={_('Copy TOTP URI')}
						on:click|preventDefault={onCopyTotpUri}
					>
						{#if !totpUriCopied}
							<span class="icon-[mdi--clipboard-text] icon-align"></span>
						{:else}
							<span class="icon-[mdi--check] icon-align"></span>
						{/if}
					</button>
				</div>
			</label>
		</div>

		<div class="form-cols grid-cols-1 md:grid-cols-3">

			<div class="form-group">
				<label>
					<div class="label">
						{_('TOTP Algorithm')}
					</div>
					<select
						class="form-input"
						bind:value={totpConfig.algorithm}
						on:change|preventDefault={onChangeTotpAlgorithm}
					>
						{#each totpAlgorithms as algorithm}
							<option value={algorithm}>{algorithm}</option>
						{/each}
					</select>
				</label>
			</div>


			<div class="form-cols grid-cols-1 sm:grid-cols-2 col-span-2">

				<div class="form-group">
					<label>
						<div class="label">
							{_('TOTP Digits')}
						</div>
						<input
							type="number"
							min="1"
							max="20"
							class="form-input"
							bind:value={totpConfig.digits}
							on:input|preventDefault={onChangeTotpDigits}
							on:change|preventDefault={onChangeTotpDigits}
						/>
					</label>
				</div>

				<div class="form-group">
					<label>
						<div class="label">
							{_('TOTP Period (seconds)')}
						</div>
						<input
							type="number"
							min="1"
							max="3600"
							class="form-input"
							bind:value={totpConfig.period}
							on:input|preventDefault={onChangeTotpPeriod}
							on:change|preventDefault={onChangeTotpPeriod}
						/>
					</label>
				</div>

			</div>
		</div>

		<div class="form-group">
			<label>
				<div class="label">
					{_('TOTP Secret')}
				</div>
				<div class="form-input-group">
					<button
						class="form-input-button"
						aria-label={_('Paste TOTP Secret')}
						on:click|preventDefault={onPasteTotpSecret}
					>
						<span class="icon-[mdi--clipboard-arrow-right] icon-align"></span>
					</button>
					<input
						type="text"
						class="form-input"
						placeholder="Base32 encoded secret"
						bind:value={totpConfig.secret}
						on:input|preventDefault={onChangeTotpSecret}
						on:change|preventDefault={onChangeTotpSecret}
					/>
					<button
						class="form-input-button"
						aria-label={_('Copy TOTP Secret')}
						on:click|preventDefault={onCopyTotpSecret}
					>
						{#if !totpSecretCopied}
							<span class="icon-[mdi--clipboard-text] icon-align"></span>
						{:else}
							<span class="icon-[mdi--check] icon-align"></span>
						{/if}
					</button>
				</div>
			</label>
		</div>

		<div class="form-group form-group-inline">
			<button class="btn btn-primary" on:click|preventDefault={onSubmit}>
				{_('Convert')}
			</button>
			<button class="btn btn-secondary" on:click|preventDefault={onReset}>
				{_('Reset')}
			</button>
		</div>

	</form>

	<hr />

	<div class="results">
		{#if totpCode}
			<!-- Circular Progress -->
			<!-- <div class="progress-and-code">
				<div class="relative size-20">
					<svg class="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"> -->
			<div class="progress-and-code">
				<div class="progress-disc">
					<svg class="progress-svg" width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
						<circle
							class="progress-bg"
							cx="24" cy="24" r={progressDiscRadius}
							fill="none"
							stroke-width="4"
						/>
						<circle
							class="progress-fg"
							cx="24" cy="24" r={progressDiscRadius}
							fill="none"
							stroke-width="4"
							stroke-dasharray={progressDiscCircumference}
							stroke-dashoffset={(1 - totpRemaining / 1000 / totpConfig.period) * progressDiscCircumference}
							stroke-linecap="round"
							transform="rotate(-90 24 24)"
						/>
					</svg>
					<div class="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2">
						<span class="text-center text-xl font-bold text-blue-600 dark:text-blue-500">
							{(totpRemaining / 1000).toFixed(0)}s
						</span>
					</div>
				</div>

				<div class="content">
					<div class="code-wrapper">
						<div class="totp-code">
							{totpCode}
						</div>
						<button
							class="copy-code"
							aria-label={_('Copy TOTP code')}
							on:click|preventDefault={onCopyTotpCode}
						>
							{#if !totpCodeCopied}
								<span class="icon-[mdi--clipboard-text] icon-align"></span>
							{:else}
								<span class="icon-[mdi--check] icon-align"></span>
							{/if}
						</button>
					</div>

					<div class="dev-wrapper">
						<div>
							{_('TOTP Counter')}:
							<code>{totpCounter}</code>
						</div>
						<div>
							{_('TOTP Remaining Time')}:
							<code>{totpRemaining / 1000}s</code>
						</div>
					</div>
				</div>
			</div>
		{:else if errorMessage}
			<p class="text-red-600 mb-4">
				{errorMessage}
			</p>
		{:else}
			<p class="text-gray-600 mb-4">
				{_('Fill the form to generate a TOTP code.')}
			</p>
		{/if}
	</div>

</div>

<style lang="scss">
@reference "tailwindcss/theme";

.form {
	@apply
		flex flex-col gap-4
		;

	.form-cols {
		@apply grid gap-4;
	}

	.form-group {
		@apply flex flex-col justify-start items-start;

		&.form-group-inline {
			@apply flex-row gap-2;
		}

		> label {
			@apply contents;
		}

		.label {
			@apply w-full pb-1 text-gray-700;
		}
	}

	.form-input {
		@apply
			block bg-gray-100
			w-full p-2 rounded-md
			flex-1
			border border-gray-300
			;

		&.default {
			@apply text-gray-600
		}

		&.error {
			@apply border-red-600 text-red-600;
		}
	}

	.form-input-button {
		@apply
			flex items-center justify-center
			p-2 text-xl text-gray-500 hover:text-gray-700
			cursor-pointer
			transition-colors duration-200
			bg-gray-200
			border border-gray-300
			rounded-md
			;

		// .icon-align {
		// 	@apply size-6;
		// }
	}

	.form-input-group {
		@apply
			flex items-stretch justify-center
			w-full rounded-md
			;

		> * {
			@apply shrink-0;

			&:not(:first-child) {
				@apply rounded-l-none;
			}

			&:not(:last-child) {
				@apply border-r-0;
				@apply rounded-r-none;
			}
		}

		> .form-input {
			@apply grow shrink;
		}
	}
}

hr {
	@apply my-6 border-gray-300;
}

.results {
	> div {
		@apply mb-2;
	}

	code {
		@apply font-mono;
	}

	/* added: layout for the progress + code */
	.progress-and-code {
		@apply flex items-center gap-4;

		.progress-disc {
			@apply shrink-0;
			@apply relative size-20;
			// position: relative;
			// width: 48px;
			// height: 48px;
			// flex: 0 0 48px;

			.progress-svg {
				@apply block size-full;

				.progress-bg {
					@apply stroke-current text-gray-200 dark:text-neutral-700;
					// stroke: var(--tw-prose-pre-bg, #e5e7eb); /* gray-200 */
				}

				.progress-fg {
					@apply stroke-current text-blue-600 dark:text-blue-500;
					// stroke: var(--tw-prose-code, #3b82f6); /* blue-500 */
					// transition: stroke-dashoffset 200ms linear;
				}
			}
		}

		.content {
			@apply flex flex-col items-start justify-center gap-1 w-full;
		}

		.code-wrapper {
			@apply flex items-center justify-center gap-1;
			@apply pl-3 pr-1 py-1 rounded-md border border-gray-300 dark:border-neutral-600;

			.totp-code {
				@apply text-3xl font-bold text-blue-600 dark:text-blue-500 font-mono;
				// color: var(--tw-prose-code, #3b82f6); /* blue-500 */
			}

			.copy-code {
				@apply
					flex items-center justify-center
					p-1 pl-2
					text-xl text-gray-500 hover:text-gray-700
					cursor-pointer
					transition-colors duration-200
					;
			}
		}

		.dev-wrapper {
			@apply hidden flex flex-col items-start justify-center gap-1;

			> * {
				@apply text-gray-700;
			}
		}
	}
}

.btn {
	@apply
		bg-gray-400
		enabled:hover:bg-gray-500
		disabled:bg-gray-300
		px-4
		py-2
		text-white
		font-semibold
		rounded-md
		disabled:cursor-not-allowed
		;

	&.btn-primary {
		@apply
			bg-blue-500
			enabled:hover:bg-blue-600
			disabled:bg-blue-300
			;
	}
}
</style>
