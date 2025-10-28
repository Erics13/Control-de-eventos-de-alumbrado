import React from 'react';

interface HistoricalFilterControlsProps {
    dateRange: { start: Date | null; end: Date | null };
    setDateRange: (range: { start: Date | null; end: Date | null }) => void;
    year: string;
    setYear: (year: string) => void;
    month: string;
    setMonth: (month: string) => void;
    availableYears: string[];
    onClear: () => void;
}

const meses = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' }, { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' }, { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' }, { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const HistoricalFilterControls: React.FC<HistoricalFilterControlsProps> = ({
    dateRange, setDateRange, year, setYear, month, setMonth, availableYears, onClear
}) => {

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>, part: 'start' | 'end') => {
        const value = e.target.value ? new Date(e.target.value) : null;
        const newRange = { ...dateRange, [part]: value };
        
        if (newRange.start && newRange.end && newRange.start > newRange.end) {
            if(part === 'start') newRange.end = newRange.start;
            else newRange.start = newRange.end;
        }
        
        setDateRange(newRange);
        setYear('');
        setMonth('');
    };

    const dateToInputValue = (date: Date | null) => {
        if (!date) return '';
        const tzoffset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - tzoffset)).toISOString().split('T')[0];
    };

    return (
        <div className="flex flex-wrap items-center gap-4">
            <div>
                <label htmlFor="h-start-date" className="sr-only">Fecha Inicio</label>
                <input
                    id="h-start-date" type="date" value={dateToInputValue(dateRange.start)}
                    onChange={(e) => handleDateChange(e, 'start')}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    onClick={e => e.stopPropagation()}
                />
            </div>
            <div>
                <label htmlFor="h-end-date" className="sr-only">Fecha Fin</label>
                <input
                    id="h-end-date" type="date" value={dateToInputValue(dateRange.end)}
                    onChange={(e) => handleDateChange(e, 'end')}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500"
                    onClick={e => e.stopPropagation()}
                />
            </div>
             <div className="flex gap-2">
                <div>
                    <label htmlFor="h-month-select" className="sr-only">Mes</label>
                    <select
                        id="h-month-select" value={month} onChange={(e) => { setMonth(e.target.value); setDateRange({start: null, end: null}); }}
                        disabled={availableYears.length === 0}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                    >
                        <option value="">Mes...</option>
                        {meses.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="h-year-select" className="sr-only">Año</label>
                    <select
                        id="h-year-select" value={year} onChange={(e) => { setYear(e.target.value); setDateRange({start: null, end: null}); }}
                        disabled={availableYears.length === 0}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50"
                    >
                        <option value="">Año...</option>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="bg-gray-600 hover:bg-red-600 text-sm font-medium py-2 px-3 rounded-md transition-colors"
                title="Limpiar filtros de historial"
            >
                Limpiar
            </button>
        </div>
    );
};

export default HistoricalFilterControls;
