
import React, { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const panelId = `collapsible-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;

    return (
        <div className="bg-gray-800 shadow-lg rounded-xl">
            <div
                className={`p-6 flex justify-between items-center cursor-pointer hover:bg-gray-700/50 transition-colors ${!isOpen ? 'rounded-xl' : 'rounded-t-xl'}`}
                onClick={() => setIsOpen(!isOpen)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(!isOpen); } }}
                aria-expanded={isOpen}
                aria-controls={panelId}
            >
                <h3 className="text-xl font-semibold text-cyan-400">{title}</h3>
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div id={panelId} className="px-6 pb-6 border-t border-gray-700">
                    <div className="pt-6">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollapsibleSection;
