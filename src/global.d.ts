import type { Snippet } from 'svelte';

// Extend Svelte 5 HTML/Component JSX attributes globally
declare module 'svelte/elements' {
    interface HTMLAttributes<T> {
        children?: Snippet;
    }
}

// Global declaration to allow 'children' on any component type
declare global {
    namespace svelteHTML {
        interface HTMLAttributes {
            children?: Snippet;
        }
    }
}

export {};