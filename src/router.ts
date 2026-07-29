import { createRouter } from 'sv-router';
import type { Component } from 'svelte';
import HomePage from './pages/home/page.svelte';

interface PageEntry {
	id: string;
	label: string;
	path: string;
	component: Component;
}

export const routes: PageEntry[] = [
	{ id: 'home', label: 'Strona główna', path: '/', component: HomePage },
];

const routesMap = routes.reduce(
	(acc, route) => {
		acc[route.path] = route.component;
		return acc;
	},
	{} as Record<string, Component>
);

export const { p, navigate, isActive, route } = createRouter(routesMap, {
	base: import.meta.env.BASE_URL,
});
