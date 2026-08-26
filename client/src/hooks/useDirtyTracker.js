import { useEffect } from 'react';
import { setDirty } from '../store/dirtyState';

export function useDirtyTracker(pageKey, isDirty) {
    useEffect(() => {
        setDirty(pageKey, isDirty);
        return () => setDirty(pageKey, false);
    }, [pageKey, isDirty]);
}
