import { createRouter, type RouteComponent, type Routes } from 'sv-router';
import HomePage from './pages/home/page.svelte';
import { isDynamic, type RoutePath, routes } from './routes';

const QuestionsPage = () => import('./pages/questions/page.svelte');
const TestsPage = () => import('./pages/tests/page.svelte');
const TestDetailPage = () => import('./pages/tests/detail.svelte');
const TestRevisionPage = () => import('./pages/tests/revision.svelte');
const DebugGradingSheetPage = () => import('./pages/debug/grading-sheet.svelte');

type RoutesMap = { [key in RoutePath]: RouteComponent };
const routesMap = {
	'/': HomePage,
	'/questions': QuestionsPage,
	'/tests': TestsPage,
	'/tests/new': TestDetailPage,
	'/tests/:id': TestDetailPage,
	'/tests/:id/revision/new': TestRevisionPage,
	'/tests/:id/revision/:revisionId': TestRevisionPage,
	'/debug/grading-sheet': DebugGradingSheetPage,
} satisfies RoutesMap;

export type Route = keyof typeof routesMap;
export type DynamicRoute = Extract<Route, `${string}/:${string}`>;
export type StaticRoute = Exclude<Route, DynamicRoute>;

function isRoutePath(path: string): path is keyof typeof routesMap {
	return path in routesMap;
}

function filterRoutes(): typeof routesMap {
	const result: Routes = {};

	for (const r of routes) {
		if (r.debug && !import.meta.env.DEV) continue;
		if (!isRoutePath(r.path)) continue;

		result[r.path] = routesMap[r.path];
	}

	return result as typeof routesMap;
}

interface PageEntryStatic {
	id: string;
	label: string;
	path: StaticRoute;
	debug?: boolean;
}
export const staticRoutes = routes.filter((r) => !isDynamic(r)) as PageEntryStatic[];

export const staticRoutesChildren = (() => {
	const mapping: { [key in RoutePath]: RoutePath[] } = {};
	for (const r of routes) {
		if (isDynamic(r)) {
			const sPath = r.path.split('/:')[0];
			const parent = routes.find((sr) => sr.path === sPath);
			if (!parent) {
				console.error(`No parent for dynamic route ${r.path}`);
				continue;
			}
			if (!mapping[parent.path]) {
				mapping[parent.path] = [];
			}
			mapping[parent.path].push(r.path);
		}
	}
	return mapping as { [key in Route]: Route[] };
})();

const filteredRoutes = filterRoutes();

export const { p, navigate, isActive, route } = createRouter(filteredRoutes, {
	base: import.meta.env.BASE_URL,
});
