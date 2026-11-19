const DEVICE_ID_STORAGE_KEY = 'sipe_device_id';

function generateUuidFallback() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        const v = c === 'x' ? r : ((r & 0x3) | 0x8);
        return v.toString(16);
    });
}

/**
 * Returns a stable per-browser device identifier persisted in localStorage.
 */
export function getDeviceId() {
    try {
        let existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (existing && existing.trim()) {
            return existing.trim().slice(0, 64);
        }
        const created = generateUuidFallback().slice(0, 64);
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
        return created;
    } catch {
        return generateUuidFallback().slice(0, 64);
    }
}
