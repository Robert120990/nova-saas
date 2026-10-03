let dirtyPages = {};

export const setDirty = (pageKey, isDirty) => {
    if (isDirty) dirtyPages[pageKey] = true;
    else delete dirtyPages[pageKey];
};

export const isAnyDirty = () => Object.keys(dirtyPages).length > 0;
export const getDirtyPages = () => Object.keys(dirtyPages);
export const clearAllDirty = () => { dirtyPages = {}; };

// Protección global nativa contra recarga accidental o cierre de pestaña cuando hay datos sin guardar
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', (e) => {
        if (isAnyDirty()) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });
}
