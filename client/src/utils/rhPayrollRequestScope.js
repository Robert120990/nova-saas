/** Impide que respuestas anteriores reemplacen el período que está en pantalla. */
export const createPayrollRequestScope = () => {
    let context;
    let generation = 0;
    let controller;

    const cancel = () => {
        generation += 1;
        controller?.abort();
        controller = null;
    };

    return {
        setContext: (nextContext) => { context = nextContext; },
        cancel,
        begin: () => {
            cancel();
            const requestContext = context;
            const requestGeneration = generation;
            const requestController = new AbortController();
            controller = requestController;
            return {
                signal: requestController.signal,
                isCurrent: () => !requestController.signal.aborted
                    && generation === requestGeneration && context === requestContext
            };
        }
    };
};
