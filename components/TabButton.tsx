import React from 'react';
import type { ActiveTab } from '../types';

interface TabButtonProps {
    tabId: ActiveTab;
    title: string;
    activeTab: ActiveTab;
    setActiveTab: (tabId: ActiveTab) => void;
    onPopOut: (tabId: ActiveTab) => void;
    disabled?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ tabId, title, activeTab, setActiveTab, onPopOut, disabled }) => {
    const isActive = activeTab === tabId;

    const handlePopOutClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onPopOut(tabId);
    };

    return (
        <button
            onClick={() => setActiveTab(tabId)}
            disabled={disabled}
            className={`flex items-center gap-2 whitespace-nowrap py-4 px-3 border-b-2 font-medium text-lg transition-colors ${
                disabled
                    ? 'text-gray-600 border-transparent cursor-not-allowed'
                    : isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            }`}
            aria-current={isActive ? 'page' : undefined}
        >
            {title}
            {!disabled && (
                 <button onClick={handlePopOutClick} title={`Abrir ${title} en nueva ventana`} className="p-1 rounded-full hover:bg-gray-700 text-gray-500 hover:text-cyan-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                 </button>
            )}
        </button>
    );
};

export default TabButton;