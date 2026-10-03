// Serialize saves and drain edits made while the previous request was in flight.
// Each request uses an immutable employee/period snapshot.
export function createPayrollSaveQueue({ read, persist, accept, onBusy }) {
    let running = null;
    return () => {
        if (running) return running;
        onBusy(true);
        running = (async () => {
            let id;
            do {
                const snapshot = read();
                if (!snapshot.empleado_id || !snapshot.detalles.length) return id;
                const result = await persist(snapshot);
                id = result.id;
                accept(snapshot, result);
                const current = read();
                if (current.key !== snapshot.key || current.editRevision === snapshot.editRevision) return id;
            } while (read().empleado_id);
            return id;
        })().finally(() => {
            running = null;
            onBusy(false);
        });
        return running;
    };
}
