
import React from 'react';
import type { ActiveTab, UserProfile } from '../types';
import { meses } from '../constants'; // Import meses from constants

interface FilterControlsProps {
    activeTab: ActiveTab;
    userProfile: UserProfile | null;
    dateRange: { start: Date | null; end: Date | null };
    setDateRange: (range: { start: Date | null; end: Date | null }) => void;
    handleSetDatePreset: (preset: 'today' | 'yesterday' | 'week' | 'month' | 'year') => void;
    selectedZone: string;
    setSelectedZone: (zone: string) => void;
    selectedMunicipio: string;
    setSelectedMunicipio: (municipio: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    zones: string[];
    municipios: string[];
    failureCategories: string[];
    availableYears: string[];
    selectedMonth: string;
    setSelectedMonth: (month: string) => void;
    selectedYear: string;
    setSelectedYear: (year: string) => void;
    availablePowers: string[];
    selectedPower: string;
    setSelectedPower: (power: string) => void;
    availableCalendars: string[];
    selectedCalendar: string;
    setSelectedCalendar: (calendar: string) => void;
    handleClearFilters: () => void; // New prop for clearing all filters
}

export const FilterControls: React.FC<FilterControlsProps> = ({
    activeTab,
    userProfile,
    dateRange,
    setDateRange,
    handleSetDatePreset,
    selectedZone,
    setSelectedZone,
    selectedMunicipio,
    setSelectedMunicipio,
    selectedCategory,
    setSelectedCategory,
    zones,
    municipios,
    failureCategories,
    availableYears,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    availablePowers,
    selectedPower,
    setSelectedPower,
    availableCalendars,
    selectedCalendar,
    setSelectedCalendar,
    handleClearFilters, // Destructure the new prop
}) => {
    const dateToInputValue = (date: Date | null) => {
        if (!date) return '';
        const tzoffset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - tzoffset)).toISOString().split('T')[0];
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, part: 'start' | 'end') => {
        const value = e.target.value ? new Date(e.target.value) : null;
        const newRange = { ...dateRange, [part]: value };
        
        if (newRange.start && newRange.end && newRange.start > newRange.end) {
            if(part === 'start') newRange.end = newRange.start;
            else newRange.start = newRange.end;
        }
        
        setDateRange(newRange);
        setSelectedMonth('');
        setSelectedYear('');
    };


    return (
        <div className="flex flex-col gap-4">
            {/* Fila 1: Filtros Principales */}
            <div className="flex flex-wrap gap-x-6 gap-y-4 items-end">
                {/* Rango de Fechas */}
                <div className="flex-grow min-w-80">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Rango de Fechas</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateToInputValue(dateRange.start)}
                            onChange={(e) => handleDateChange(e, 'start')}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        />
                         <span className="text-gray-500">-</span>
                        <input
                            type="date"
                            value={dateToInputValue(dateRange.end)}
                             onChange={(e) => handleDateChange(e, 'end')}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        />
                    </div>
                </div>

                {/* Filtro por Mes/Año */}
                 <div className="flex-grow min-w-60">
                     <label className="block text-sm font-medium text-gray-400 mb-1">Por Mes/Año</label>
                     <div className="flex gap-2">
                         <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">Mes...</option>
                            {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                         </select>
                         <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="">Año...</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                     </div>
                </div>

                {/* Filtros de Ubicación */}
                <div className="flex-grow min-w-60">
                    <label className="block text-sm font-medium text-gray-400 mb-1">Ubicación</label>
                    <div className="flex gap-2">
                        <select
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            disabled={userProfile?.role === 'capataz' || userProfile?.role === 'cuadrilla' || userProfile?.role === 'regional'}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="all">Todas las Zonas</option>
                            {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                        </select>
                        <select value={selectedMunicipio} onChange={(e) => setSelectedMunicipio(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="all">Todos los Municipios</option>
                            {municipios.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* Filtros Específicos de Pestaña */}
                {activeTab === 'eventos' && (
                    <div className="flex-grow min-w-52">
                        <label htmlFor="category-select" className="block text-sm font-medium text-gray-400 mb-1">Categoría de Falla</label>
                        <select id="category-select" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                            <option value="all">Todas las Categorías</option>
                            {failureCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                )}
                {activeTab === 'inventario' && (
                    <>
                        <div className="flex-grow min-w-40">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Potencia</label>
                            <select value={selectedPower} onChange={e => setSelectedPower(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                                <option value="all">Todas las Potencias</option>
                                {availablePowers.map(p => <option key={p} value={p}>{p}W</option>)}
                            </select>
                        </div>
                         <div className="flex-grow min-w-52">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Calendario Dimming</label>
                            <select value={selectedCalendar} onChange={e => setSelectedCalendar(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500">
                                <option value="all">Todos los Calendarios</option>
                                {availableCalendars.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>

             {/* Fila 2: Filtros Rápidos (Condicional) */}
             {/* Removed conditional rendering for the whole block to make the "Limpiar Filtros" button always visible. */}
                 <>
                    <hr className="border-gray-700 my-2" />
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleSetDatePreset('today')} className="text-xs bg-gray-700 hover:bg-cyan-600 text-white py-1 px-3 rounded-md transition-colors">Hoy</button>
                            <button onClick={() => handleSetDatePreset('yesterday')} className="text-xs bg-gray-700 hover:bg-cyan-600 text-white py-1 px-3 rounded-md transition-colors">Ayer</button>
                            <button onClick={() => handleSetDatePreset('week')} className="text-xs bg-gray-700 hover:bg-cyan-600 text-white py-1 px-3 rounded-md transition-colors">Últimos 7 Días</button>
                            <button onClick={() => handleSetDatePreset('month')} className="text-xs bg-gray-700 hover:bg-cyan-600 text-white py-1 px-3 rounded-md transition-colors">Mes Actual</button>
                            <button onClick={() => handleSetDatePreset('year')} className="text-xs bg-gray-700 hover:bg-cyan-600 text-white py-1 px-3 rounded-md transition-colors">Año Actual</button>
                        </div>
                        <button
                            onClick={handleClearFilters}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded-md transition-colors"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                </>
        </div>
    );
};