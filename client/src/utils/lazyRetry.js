import { lazy } from 'react';

/**
 * Standard utility for React.lazy with automatic recovery against ChunkLoadError
 * (which happens when a new version is deployed on server and old chunk hashes are replaced).
 * 
 * @param {Function} componentImport - e.g. () => import('./pages/ChartOfAccounts')
 * @returns {React.LazyExoticComponent}
 */
export function lazyWithRetry(componentImport) {
    return lazy(async () => {
        const pageAlreadyRefreshed = JSON.parse(
            window.sessionStorage.getItem('app-chunk-refresh') || 'false'
        );
        try {
            const component = await componentImport();
            window.sessionStorage.setItem('app-chunk-refresh', 'false');
            return component;
        } catch (error) {
            console.warn('[LazyRetry] Chunk loading failed, attempting auto-refresh:', error);
            if (!pageAlreadyRefreshed) {
                window.sessionStorage.setItem('app-chunk-refresh', 'true');
                window.location.reload();
                return { default: () => null };
            }
            throw error;
        }
    });
}

export default lazyWithRetry;
