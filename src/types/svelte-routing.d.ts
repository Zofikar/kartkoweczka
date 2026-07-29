declare module 'svelte-navigator' {
    import type { Component, Snippet } from 'svelte';

    export interface LinkProps {
        to: string;
        replace?: boolean;
        state?: any;
        getProps?: (props: { location: Location; href: string; isCurrent: boolean; isPartiallyCurrent: boolean }) => Record<string, any>;
        class?: string;
        style?: string;
        children?: Snippet;
        [key: string]: any;
    }

    export interface RouterProps {
        basepath?: string;
        url?: string;
        children?: Snippet;
        [key: string]: any;
    }

    export const Link: Component<LinkProps>;
    export const Router: Component<RouterProps>;
    export const Route: Component<any>;
    export const useNavigate: () => (to: string, options?: { replace?: boolean; state?: any }) => void;
    export const useLocation: () => import("svelte/store").Readable<any>;
    export const useMatch: (path: string) => import("svelte/store").Readable<any>;
}