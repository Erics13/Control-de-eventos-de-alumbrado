import React from 'react';
import type { ActiveTab } from '../types';

interface FilterControlsProps {
    activeTab: ActiveTab;
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
}

const meses = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
];

const FilterControls: React.FC<FilterControlsProps> = ({
    activeTab,
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
}) => {
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, part: 'start' | 'end') => {
        const value = e.target.value ? new Date(e.target.value) : null;
        setDateRange({ ...dateRange, [part]: value });
        setSelectedMonth('');
        setSelectedYear('');
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                 <div>
                    <label htmlFor="zone-select" className="block text-sm font-medium text-gray-400 mb-1">Zona</label>
                    <select
                        id="zone-select"
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        <option value="all">Todas las Zonas</option>
                        {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                </div>
                 <div>
                    <label htmlFor="municipio-select" className="block text-sm font-medium text-gray-400 mb-1">Municipio</label>
                    <select
                        id="municipio-select"
                        value={selectedMunicipio}
                        onChange={(e) => setSelectedMunicipio(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    >
                        <option value="all">Todos los Municipios</option>
                        {municipios.map(muni => <option key={muni} value={muni}>{muni}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="start-date-input" className="block text-sm font-medium text-gray-400 mb-1">Fecha Inicio</label>
                    <input
                        id="start-date-input"
                        type="date"
                        value={dateToInputValue(dateRange.start)}
                        onChange={(e) => handleDateChange(e, 'start')}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                </div>
                <div>
                    <label htmlFor="end-date-input" className="block text-sm font-medium text-gray-400 mb-1">Fecha Fin</label>
                    <input
                        id="end-date-input"
                        type="date"
                        value={dateToInputValue(dateRange.end)}
                        onChange={(e) => handleDateChange(e, 'end')}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    />
                </div>

                {/* Eventos & Cambios Tab Specific */}
                {(activeTab === 'eventos' || activeTab === 'cambios') && (
                    <>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label htmlFor="month-select" className="block text-sm font-medium text-gray-400 mb-1">Mes</label>
                                <select
                                    id="month-select"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    disabled={availableYears.length === 0}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                                >
                                    <option value="">...</option>
                                    {meses.map(mes => (
                                        <option key={mes.value} value={mes.value}>{mes.label.substring(0,3)}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="year-select" className="block text-sm font-medium text-gray-400 mb-1">Año</label>
                                <select
                                    id="year-select"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    disabled={availableYears.length === 0}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                                >
                                    <option value="">...</option>
                                    {availableYears.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'eventos' && (
                     <div>
                        <label htmlFor="category-select" className="block text-sm font-medium text-gray-400 mb-1">Categoría Falla</label>
                        <select
                            id="category-select"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                        >
                            <option value="all">Todas</option>
                            {failureCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                )}

                {/* Inventario Tab Specific */}
                {activeTab === 'inventario' && (
                    <>
                        <div>
                            <label htmlFor="power-select" className="block text-sm font-medium text-gray-400 mb-1">Potencia</label>
                            <select
                                id="power-select"
                                value={selectedPower}
                                onChange={(e) => setSelectedPower(e.target.value)}
                                disabled={availablePowers.length === 0}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                            >
                                <option value="all">Todas</option>
                                {availablePowers.map(p => <option key={p} value={p}>{p}W</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="calendar-select" className="block text-sm font-medium text-gray-400 mb-1">Calendario</label>
                            <select
                                id="calendar-select"
                                value={selectedCalendar}
                                onChange={(e) => setSelectedCalendar(e.target.value)}
                                disabled={availableCalendars.length === 0}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                            >
                                <option value="all">Todos</option>
                                {availableCalendars.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </>
                )}
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700">
                 <button onClick={() => handleSetDatePreset('today')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Hoy</button>
                 <button onClick={() => handleSetDatePreset('yesterday')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Ayer</button>
                 <button onClick={() => handleSetDatePreset('week')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Últimos 7 días</button>
                 <button onClick={() => handleSetDatePreset('month')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Este Mes</button>
                 <button onClick={() => handleSetDatePreset('year')} className="bg-gray-700 hover:bg-cyan-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Este Año</button>
                 <button onClick={() => {
                    setDateRange({start: null, end: null}); 
                    setSelectedZone('all'); 
                    setSelectedMunicipio('all'); 
                    setSelectedCategory('all');
                    setSelectedMonth('');
                    setSelectedYear('');
                    setSelectedPower('all');
                    setSelectedCalendar('all');
                 }} className="ml-auto bg-gray-700 hover:bg-red-600 text-sm font-medium py-1 px-3 rounded-md transition-colors">Limpiar Filtros</button>
            </div>
        </div>
    );
};

export default FilterControls;