import { createRouter } from 'sv-router';
import type { Component } from 'svelte';
import HomePage from './pages/home/page.svelte';
import QuestionsPage from './pages/questions/page.svelte';
import TestsPage from './pages/tests/page.svelte';
import TestDetailPage from './pages/tests/detail.svelte';
import TestRevisionPage from './pages/tests/revision.svelte';

export type StaticPagePath = '/' | '/questions' | '/tests';

export interface PageEntry {
	id: string;
	label: string;
	path: StaticPagePath;
	component: Component;
}

export const routes: PageEntry[] = [
	{ id: 'home', label: 'Strona główna', path: '/', component: HomePage },
	{ id: 'questions', label: 'Pytania', path: '/questions', component: QuestionsPage },
	{ id: 'tests', label: 'Testy', path: '/tests', component: TestsPage },
];

const routesMap = {
	'/': HomePage,
	'/questions': QuestionsPage,
	'/tests': TestsPage,
	'/tests/new': TestDetailPage,
	'/tests/:id': TestDetailPage,
	'/tests/:id/revision/new': TestRevisionPage,
	'/tests/:id/revision/:revisionId': TestRevisionPage,
};

export const { p, navigate, isActive, route } = createRouter(routesMap, {
	base: import.meta.env.BASE_URL,
});
