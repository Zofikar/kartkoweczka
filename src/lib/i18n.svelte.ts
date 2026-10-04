import englishMessages from '../../lang/en.json';
import polishMessages from '../../lang/pl.json';

export const supportedLocales = ['pl', 'en'] as const;

export type Locale = (typeof supportedLocales)[number];

type TranslationTree = { [key: string]: string | TranslationTree };
type TranslationShape<T> = {
	[K in keyof T]: T[K] extends string
		? string
		: T[K] extends Record<string, unknown>
			? TranslationShape<T[K]>
			: never;
};
type LeafPaths<T> = {
	[K in keyof T & string]: T[K] extends string
		? K
		: T[K] extends Record<string, unknown>
			? `${K}.${LeafPaths<T[K]>}`
			: never;
}[keyof T & string];

export type TranslationKey = LeafPaths<typeof polishMessages>;
export type TranslationParams = Record<string, string | number>;

const STORAGE_KEY = 'locale';

const messages = {
	pl: polishMessages,
	en: englishMessages satisfies TranslationShape<typeof polishMessages>,
} satisfies Record<Locale, TranslationTree>;

function resolveMessage(tree: TranslationTree, key: TranslationKey): string {
	let value: string | TranslationTree = tree;
	for (const segment of key.split('.')) {
		if (typeof value === 'string' || !(segment in value)) return key;
		value = value[segment];
	}
	return typeof value === 'string' ? value : key;
}

function interpolate(message: string, params?: TranslationParams): string {
	if (!params) return message;
	return message.replace(/\{(\w+)\}/g, (match, key: string) =>
		Object.hasOwn(params, key) ? String(params[key]) : match
	);
}

function detectLocale(): Locale {
	if (typeof window === 'undefined') return 'pl';

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'pl' || stored === 'en') return stored;
	} catch {
		// Use the browser preference when storage is unavailable.
	}

	return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

class I18nState {
	locale = $state<Locale>(detectLocale());

	t = (key: TranslationKey, params?: TranslationParams): string =>
		interpolate(resolveMessage(messages[this.locale], key), params);

	setLocale(locale: Locale) {
		this.locale = locale;
		if (typeof document !== 'undefined') document.documentElement.lang = locale;

		try {
			localStorage.setItem(STORAGE_KEY, locale);
		} catch {
			// The language still changes for the current session.
		}
	}

	initialize() {
		this.setLocale(this.locale);
	}
}

export const i18n = new I18nState();
