import { createRouter } from 'sv-router';
import type { Routes } from 'sv-router';
import HomePage from './pages/home/page.svelte';
import QuestionsPage from './pages/questions/page.svelte';
import TestsPage from './pages/tests/page.svelte';
import TestDetailPage from './pages/tests/detail.svelte';
import TestRevisionPage from './pages/tests/revision.svelte';

export const isDebugRouteEnabled = import.meta.env.DEV || import.meta.env.MODE === 'debug';

const DebugGradingSheetPage = () => import('./pages/debug/grading-sheet.svelte');

export type StaticPagePath = '/' | '/questions' | '/tests' | '/debug/grading-sheet';

export interface PageEntry {
	id: string;
	label: string;
	path: StaticPagePath;
	component: unknown;
}

export const routes: PageEntry[] = [
	{ id: 'home', label: 'Strona główna', path: '/', component: HomePage },
	{ id: 'questions', label: 'Pytania', path: '/questions', component: QuestionsPage },
	{ id: 'tests', label: 'Testy', path: '/tests', component: TestsPage },
	...(isDebugRouteEnabled
		? [
				{
					id: 'debug-grading-sheet',
					label: 'DEBUG: karta odpowiedzi',
					path: '/debug/grading-sheet' as const,
					component: DebugGradingSheetPage,
				},
			]
		: []),
];

const routesMap = {
	'/': HomePage,
	'/questions': QuestionsPage,
	'/tests': TestsPage,
	'/tests/new': TestDetailPage,
	'/tests/:id': TestDetailPage,
	'/tests/:id/revision/new': TestRevisionPage,
	'/tests/:id/revision/:revisionId': TestRevisionPage,
	...(isDebugRouteEnabled ? { '/debug/grading-sheet': DebugGradingSheetPage } : {}),
} as const satisfies Routes;

export const { p, navigate, isActive, route } = createRouter(routesMap, {
	base: import.meta.env.BASE_URL,
});
