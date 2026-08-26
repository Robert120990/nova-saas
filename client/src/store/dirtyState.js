let dirtyPages = {};

export const setDirty = (pageKey, isDirty) => {
    if (isDirty) dirtyPages[pageKey] = true;
    else delete dirtyPages[pageKey];
};

export const isAnyDirty = () => Object.keys(dirtyPages).length > 0;
export const getDirtyPages = () => Object.keys(dirtyPages);
