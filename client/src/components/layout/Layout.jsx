import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AIAssistant from '../ui/AIAssistant';
import CommandPalette from '../ui/CommandPalette';
import ErrorBoundary from '../ui/ErrorBoundary';

const Layout = () => {
    const location = useLocation();
    const [paletteOpen, setPaletteOpen] = useState(false);

    const openPalette = useCallback(() => setPaletteOpen(true), []);
    const closePalette = useCallback(() => setPaletteOpen(false), []);

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
        <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
            <Sidebar onOpenSearch={openPalette} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-7xl mx-auto" key={location.pathname}>
                        <ErrorBoundary showDetails>
                            <Outlet />
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
