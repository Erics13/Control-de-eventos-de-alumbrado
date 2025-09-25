

import React, { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    onExport?: () => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
    title, 
    children, 
    defaultOpen = false,
    isOpen: controlledIsOpen,
    onToggle,
    onExport,
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

    const isControlled = controlledIsOpen !== undefined;
    const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setInternalIsOpen(v => !v);
        }
    };
    
    const handleExportClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent the section from toggling
        if (onExport) {
            onExport();
        }
    };
    
    const panelId = `collapsible-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div className="bg-gray-800 shadow-lg rounded-xl">
            <div
                className={`p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700/50 transition-colors ${!isOpen ? 'rounded-xl' : 'rounded-t-xl'}`}
                onClick={handleToggle}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(); } }}
                aria-expanded={isOpen}
                aria-controls={panelId}
            >
                <h3 className="text-lg font-semibold text-cyan-400">{title}</h3>
                <div className="flex items-center gap-4">
                    {onExport && (
                        <button
                            onClick={handleExportClick}
                            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                            title="Exportar a Excel (CSV)"
                            aria-label="Exportar a Excel (CSV)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                            </svg>
                        </button>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div id={panelId} className="px-4 pb-4 border-t border-gray-700">
                    <div className="pt-4">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollapsibleSection;