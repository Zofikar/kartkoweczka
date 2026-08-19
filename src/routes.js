/**
 * @typedef {`/${string}`} RoutePath
 */

/**
 * @typedef {Object} PageEntry
 * @property {string} id
 * @property {string} label
 * @property {RoutePath} path
 * @property {boolean} [debug]
 */

/**
 * @param {PageEntry} pe
 * @returns {boolean}
 */

export function isDynamic(pe) {
	return pe.path.includes('/:');
}

/** @type {PageEntry[]} */
export const routes = [
	{ id: 'home', label: 'Strona główna', path: '/' },
	{ id: 'questions', label: 'Pytania', path: '/questions' },
	{ id: 'tests', label: 'Testy', path: '/tests' },
	{ id: 'tests_new', label: 'Nowy Test', path: '/tests/new' },
	{ id: 'tests_edit', label: 'Edytuj Test', path: '/tests/:id' },
	{ id: 'test_new_revision', label: 'Nowa wersja', path: '/tests/:id/revision/new' },
	{ id: 'test_revision', label: 'Edytuj wersje', path: '/tests/:id/revision/:revisionId' },
	{
		id: 'debug-grading-sheet',
		label: 'DEBUG: karta odpowiedzi',
		path: '/debug/grading-sheet',
		debug: true,
	},
];
