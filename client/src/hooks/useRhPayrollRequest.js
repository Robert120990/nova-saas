import { useEffect, useRef } from 'react';
import { createPayrollRequestScope } from '../utils/rhPayrollRequestScope';

export const useRhPayrollRequest = (context) => {
    const scopeRef = useRef(null);
    if (!scopeRef.current) scopeRef.current = createPayrollRequestScope();
    const scope = scopeRef.current;
    scope.setContext(context);
    useEffect(() => () => scope.cancel(), [scope]);
    return scope;
};
