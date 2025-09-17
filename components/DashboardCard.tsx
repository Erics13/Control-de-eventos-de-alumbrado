
import React from 'react';

interface DashboardCardProps {
    title: string;
    value: string;
    onClick?: () => void;
    isActive?: boolean;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, onClick, isActive }) => {
    
    const clickableClasses = onClick 
        ? "cursor-pointer hover:shadow-cyan-500/20 hover:-translate-y-1 transform" 
        : "";
        
    const activeClasses = isActive 
        ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-gray-800" 
        : "";

    return (
        <div 
            className={`bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 transition-all duration-200 ${clickableClasses} ${activeClasses}`}
            onClick={onClick}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={e => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
            aria-pressed={isActive}
        >
            <h3 className="text-gray-400 text-md font-medium mb-2">{title}</h3>
            <p className="text-4xl font-bold text-cyan-400">{value}</p>
        </div>
    );
};

export default DashboardCard;
