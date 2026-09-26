import { useState, useEffect, useCallback, Suspense } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AIAssistant from '../ui/AIAssistant';
import CommandPalette from '../ui/CommandPalette';
import ErrorBoundary from '../ui/ErrorBoundary';

const PageLoader = () => (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-8 space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
            Cargando sección...
        </span>
    </div>
);

const Layout = () => {
    const location = useLocation();
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const openPalette = useCallback(() => setPaletteOpen(true), []);
    const closePalette = useCallback(() => setPaletteOpen(false), []);
    const toggleMobileMenu = useCallback(() => setMobileMenuOpen(prev => !prev), []);
    const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

    // Auto-cerrar menú móvil cuando cambia la ruta
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setPaletteOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900" style={{ height: '100dvh' }}>
            <Sidebar 
                onOpenSearch={openPalette} 
                isMobileOpen={mobileMenuOpen} 
                onCloseMobile={closeMobileMenu} 
            />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Navbar onToggleMobileMenu={toggleMobileMenu} />
                <main className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
                    <div className="max-w-7xl mx-auto" key={location.pathname}>
                        <ErrorBoundary showDetails>
                            <Suspense fallback={<PageLoader />}>
                                <Outlet />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </main>
                <AIAssistant />
            </div>
            <CommandPalette isOpen={paletteOpen} onClose={closePalette} />
        </div>
    );
};

export default Layout;
