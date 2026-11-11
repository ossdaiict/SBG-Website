import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar';

interface PublicLayoutProps {
    onGoToLogin: () => void;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ onGoToLogin }) => {
    const location = useLocation();
    const isRoot = location.pathname === '/';

    return (
        <div className="flex flex-col min-h-dvh bg-bgMain">
            {!isRoot && <PublicNavbar onGoToLogin={onGoToLogin} />}
            <div className="flex-1">
                <Outlet />
            </div>
        </div>
    );
};
