

import React from 'react';

interface HeaderProps {
    isDataManagementVisible: boolean;
    onToggleDataManagement: () => void;
    isFiltersVisible: boolean;
    onToggleFilters: () => void;
}

const Header: React.FC<HeaderProps> = ({
    isDataManagementVisible,
    onToggleDataManagement,
    isFiltersVisible,
    onToggleFilters,
}) => {
    return (
        <header className="bg-gray-800/50 backdrop-blur-sm shadow-lg flex-shrink-0 z-20">
            <div className="container mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider">
                        Gestión Alumbrado Público Canelones
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleFilters}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            isFiltersVisible
                                ? 'bg-cyan-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        aria-pressed={isFiltersVisible}
                        aria-controls="filters-panel"
                    >
                        Filtros y Análisis
                    </button>
                    <button
                        onClick={onToggleDataManagement}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            isDataManagementVisible
                                ? 'bg-cyan-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                        aria-pressed={isDataManagementVisible}
                        aria-controls="data-management-panel"
                    >
                        Gestión de Datos
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;