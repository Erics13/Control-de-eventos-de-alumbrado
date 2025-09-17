
import React from 'react';

interface FilterControlsProps {
    dateRange: { start: Date | null; end: Date | null };
    setDateRange: (range: { start: Date | null; end: Date | null }) => void;
    handleSetDatePreset: (preset: 'week' | 'month' | 'year') => void;
    selectedZone: string;
    setSelectedZone: (zone: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    zones: string[];
    failureCategories: string[];
}

const FilterControls: React.FC<FilterControlsProps> = ({
    dateRange,
    setDateRange,
    handleSetDatePreset,
    selectedZone,
    setSelectedZone,
    selectedCategory,
    setSelectedCategory,
    zones,
    failureCategories
}) => {
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, part: 'start' | 'end') => {
        const value = e.target.value ? new Date(e.target.value) : null;
        setDateRange({ ...dateRange, [part]: value });
    };

    const dateToInputValue = (date: Date | null) => {
        if (!date) return '';
        // Adjust for timezone offset before formatting
        const tzoffset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().split('T')[0];
        return localISOTime;
    };


    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Fecha Inicio</label>
                    <input
                        type="date"
                        value={dateToInputValue(dateRange.start)}
                        onChange={(e) => handleDateChange(e, 'start')}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Fecha Fin</label>
                    <input
                        type="date"
                        value={dateToInputValue(dateRange.end)}
                        onChange={(e) => handleDateChange(e, 'end')}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Zona de Alumbrado</label>
                    <select
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        <option value="all">Todas las Zonas</option>
                        {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Categoría de Falla</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        <option value="all">Todas las Categorías</option>
                        {failureCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
                 <button onClick={() => handleSetDatePreset('week')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Últimos 7 días</button>
                 <button onClick={() => handleSetDatePreset('month')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Este Mes</button>
                 <button onClick={() => handleSetDatePreset('year')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Este Año</button>
                 <button onClick={() => {setDateRange({start: null, end: null}); setSelectedZone('all'); setSelectedCategory('all')}} className="bg-gray-700 hover:bg-red-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Limpiar Filtros</button>
            </div>
        </div>
    );
};

export default FilterControls;
