import React from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import AIAssistant from '../ui/AIAssistant';

const Layout = () => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Navbar />
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                    <div className="max-w-7xl mx-auto" key={location.pathname}>
                        <Outlet />
                    </div>
                </main>
                <footer className="text-center py-2 border-t border-slate-100 bg-white">
                    <p className="text-[10px] text-slate-400 font-mono">
                        v.{__GIT_COMMIT__}
                    </p>
                </footer>
                <AIAssistant />
            </div>
        </div>
    );
};

export default Layout;
