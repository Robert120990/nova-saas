import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Simulate dirtyState.js logic
let dirtyPages = {};
const setDirty = (pageKey, isDirty) => {
    if (isDirty) dirtyPages[pageKey] = true;
    else delete dirtyPages[pageKey];
};
const isAnyDirty = () => Object.keys(dirtyPages).length > 0;
const clearAllDirty = () => { dirtyPages = {}; };

// Simulation of useSafeNavigate core logic
function createSafeNavigator({ confirmFn, navigateFn, currentPath = '/pos' }) {
    let current = currentPath;

    const handleSafeLinkClick = async (e, targetPath, onNavigateSuccess) => {
        if (!targetPath || current === targetPath) {
            onNavigateSuccess?.();
            return;
        }

        if (isAnyDirty()) {
            e.preventDefault();

            const ok = await confirmFn({
                title: '¿Descartar cambios no guardados?',
                message: 'Tienes información ingresada en esta pantalla que aún no ha sido guardada. Si cambias de menú, estos datos se perderán.',
                confirmLabel: 'Descartar y salir',
                cancelLabel: 'Permanecer aquí',
                variant: 'warning'
            });

            if (ok) {
                clearAllDirty();
                current = targetPath;
                navigateFn(targetPath);
                onNavigateSuccess?.();
            }
        } else {
            current = targetPath;
            onNavigateSuccess?.();
        }
    };

    const safeNavigate = async (targetPath, options = {}) => {
        if (!targetPath) return false;
        if (current === targetPath) return true;

        if (isAnyDirty()) {
            const ok = await confirmFn({
                title: '¿Descartar cambios no guardados?',
                message: 'Tienes información ingresada en esta pantalla que aún no ha sido guardada. Si cambias de sección, estos datos se perderán.',
                confirmLabel: 'Descartar y salir',
                cancelLabel: 'Permanecer aquí',
                variant: 'warning'
            });

            if (!ok) return false;
            clearAllDirty();
        }

        current = targetPath;
        navigateFn(targetPath, options);
        return true;
    };

    const confirmAction = async (actionCallback, options = {}) => {
        if (isAnyDirty()) {
            const ok = await confirmFn({
                title: options.title || '¿Descartar cambios no guardados?',
                message: options.message || 'Tienes información ingresada en esta pantalla que aún no ha sido guardada. Si continúas, estos datos se perderán.',
                confirmLabel: options.confirmLabel || 'Descartar y continuar',
                cancelLabel: options.cancelLabel || 'Permanecer aquí',
                variant: 'warning'
            });

            if (!ok) return false;
            clearAllDirty();
        }

        if (actionCallback) await actionCallback();
        return true;
    };

    return {
        handleSafeLinkClick,
        safeNavigate,
        confirmAction,
        getCurrentPath: () => current
    };
}

describe('Safe Navigation & Internal Unsaved Changes Guard Tests', () => {
    beforeEach(() => {
        clearAllDirty();
    });

    test('should navigate immediately when there are no dirty pages', async () => {
        let navigatedTo = null;
        let confirmCalled = false;

        const navigator = createSafeNavigator({
            confirmFn: async () => { confirmCalled = true; return true; },
            navigateFn: (path) => { navigatedTo = path; },
            currentPath: '/dashboard'
        });

        const simulatedEvent = {
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        };

        let successCalled = false;
        await navigator.handleSafeLinkClick(simulatedEvent, '/inventario/traslados', () => {
            successCalled = true;
        });

        assert.equal(simulatedEvent.defaultPrevented, false, 'Should NOT prevent default navigation when clean');
        assert.equal(confirmCalled, false, 'Should NOT trigger confirmation modal when clean');
        assert.equal(successCalled, true);
    });

    test('should prevent navigation and prompt confirmation when dirty, then stay if user cancels', async () => {
        setDirty('Expenses', true);
        assert.equal(isAnyDirty(), true);

        let navigatedTo = null;
        let confirmPromptOptions = null;

        const navigator = createSafeNavigator({
            confirmFn: async (options) => {
                confirmPromptOptions = options;
                return false; // User clicks "Permanecer aquí"
            },
            navigateFn: (path) => { navigatedTo = path; },
            currentPath: '/compras/gastos'
        });

        const simulatedEvent = {
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        };

        let successCalled = false;
        await navigator.handleSafeLinkClick(simulatedEvent, '/products', () => {
            successCalled = true;
        });

        assert.equal(simulatedEvent.defaultPrevented, true, 'MUST prevent default route change');
        assert.ok(confirmPromptOptions !== null, 'MUST present confirmation modal');
        assert.equal(confirmPromptOptions.variant, 'warning');
        assert.equal(navigatedTo, null, 'Must NOT navigate when user cancels');
        assert.equal(successCalled, false);
        assert.equal(isAnyDirty(), true, 'Form must remain dirty');
    });

    test('should clear dirty state and navigate when user confirms discarding changes', async () => {
        setDirty('InventoryAdjustments', true);
        assert.equal(isAnyDirty(), true);

        let navigatedTo = null;

        const navigator = createSafeNavigator({
            confirmFn: async () => true, // User clicks "Descartar y salir"
            navigateFn: (path) => { navigatedTo = path; },
            currentPath: '/inventario/movimientos'
        });

        const simulatedEvent = {
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; }
        };

        let successCalled = false;
        await navigator.handleSafeLinkClick(simulatedEvent, '/ventas/nueva', () => {
            successCalled = true;
        });

        assert.equal(simulatedEvent.defaultPrevented, true);
        assert.equal(navigatedTo, '/ventas/nueva');
        assert.equal(successCalled, true);
        assert.equal(isAnyDirty(), false, 'Dirty state must be reset after confirmed discard');
    });

    test('safeNavigate should block programmatic transitions if user cancels', async () => {
        setDirty('AccountingEntries', true);

        let navigatedTo = null;
        const navigator = createSafeNavigator({
            confirmFn: async () => false, // Cancel
            navigateFn: (path) => { navigatedTo = path; },
            currentPath: '/contabilidad/partidas'
        });

        const result = await navigator.safeNavigate('/contabilidad/cuentas');
        assert.equal(result, false);
        assert.equal(navigatedTo, null);
    });

    test('safeNavigate should allow programmatic transitions if user confirms', async () => {
        setDirty('AccountingEntries', true);

        let navigatedTo = null;
        const navigator = createSafeNavigator({
            confirmFn: async () => true, // Confirm
            navigateFn: (path) => { navigatedTo = path; },
            currentPath: '/contabilidad/partidas'
        });

        const result = await navigator.safeNavigate('/contabilidad/cuentas');
        assert.equal(result, true);
        assert.equal(navigatedTo, '/contabilidad/cuentas');
        assert.equal(isAnyDirty(), false);
    });

    test('confirmAction should protect logout or branch switch when dirty', async () => {
        setDirty('SalesTerminal', true);
        let actionExecuted = false;

        const navigator = createSafeNavigator({
            confirmFn: async () => false, // User decides to stay
            navigateFn: () => {}
        });

        const executed = await navigator.confirmAction(async () => {
            actionExecuted = true;
        }, { title: '¿Cerrar sesión?' });

        assert.equal(executed, false);
        assert.equal(actionExecuted, false);
        assert.equal(isAnyDirty(), true);
    });

    test('confirmAction should proceed when confirmed and clear dirty state', async () => {
        setDirty('SalesTerminal', true);
        let actionExecuted = false;

        const navigator = createSafeNavigator({
            confirmFn: async () => true, // User confirms
            navigateFn: () => {}
        });

        const executed = await navigator.confirmAction(async () => {
            actionExecuted = true;
        }, { title: '¿Cerrar sesión?' });

        assert.equal(executed, true);
        assert.equal(actionExecuted, true);
        assert.equal(isAnyDirty(), false);
    });
});
