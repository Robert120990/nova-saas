export function createAuthenticatedSocket(path, companyId) {
    const configured = import.meta.env.VITE_API_URL || window.location.origin;
    const url = new URL(path, configured);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('company_id', String(companyId));
    return new WebSocket(url, ['sipe', `auth.${localStorage.getItem('token') || ''}`]);
}
