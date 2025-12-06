
import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import MonthlyEventSummaryChart from './MonthlyEventSummaryChart';
import HistoricalSummaryTable from './HistoricalSummaryTable';
import DashboardCard from './DashboardCard';
import UniqueFailuresByZoneTable from './UniqueFailuresByZoneTable';
import CabinetFailuresTable from './CabinetFailuresTable';
import type { HistoricalData, CabinetFailureDetail } from '../types';
// FIX: The 'parse' and 'format' functions should be imported from their specific subpaths.
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { es } from 'date-fns/locale/es';

interface HistorialTabProps {
    historicalData: HistoricalData;
    uniqueFailuresInDateRange: number;
    uniqueFailuresByZoneInDateRange: { name: string; count: number }[];
    cabinetFailuresInDateRange: CabinetFailureDetail[];
    cabinetFailuresForSelectedMonth: CabinetFailureDetail[];
    dateRange: { start: Date | null; end: Date | null };
    handleExportHistoricalSummary?: () => void;
    selectedHistoricalMonthZone: { month: string, zone: string } | null;
    setSelectedHistoricalMonthZone: (selection: { month: string, zone: string } | null) => void;
}


const HistorialTab: React.FC<HistorialTabProps> = ({
    historicalData,
    uniqueFailuresInDateRange,
    uniqueFailuresByZoneInDateRange,
    cabinetFailuresInDateRange,
    cabinetFailuresForSelectedMonth,
    dateRange,
    handleExportHistoricalSummary,
    selectedHistoricalMonthZone,
    setSelectedHistoricalMonthZone,
}) => {

    if (!dateRange.start || !dateRange.end) {
        return (
            <div className="text-center p-16 bg-gray-800 rounded-lg">
                <h2 className="text-2xl font-semibold text-gray-300">Seleccione un Rango de Fechas</h2>
                <p className="text-gray-500 mt-2">
                    Por favor, utilice los filtros principales para definir un período y ver el análisis histórico de eventos.
                </p>
            </div>
        );
    }
    
    const cabinetFailuresDataToShow = selectedHistoricalMonthZone 
        ? cabinetFailuresForSelectedMonth 
        : cabinetFailuresInDateRange;

    const cabinetFailuresTitle = selectedHistoricalMonthZone
        ? `Detalle de Fallas de Gabinete para ${selectedHistoricalMonthZone.zone} en ${format(parse(selectedHistoricalMonthZone.month, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es })}`
        : 'Detalle de Luminarias en Falla de Gabinete';


    return (
        <div className="space-y-6">
            <CollapsibleSection
                title="Análisis de Fallas Únicas en Periodo Seleccionado"
                defaultOpen={true}
            >
                 <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="flex flex-col items-center justify-center h-full">
                        <DashboardCard
                            title="Puntos de Alumbrado Únicos con Falla"
                            value={uniqueFailuresInDateRange.toLocaleString('es-ES')}
                        />
                        <p className="text-center text-gray-400 mt-4 max-w-md">
                            Este valor representa el número total de luminarias únicas que reportaron al menos un evento de falla dentro del período de fechas seleccionado.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-md font-semibold text-gray-300 mb-3 text-center">Desglose por Zona</h4>
                        <UniqueFailuresByZoneTable data={uniqueFailuresByZoneInDateRange} />
                    </div>
                </div>
            </CollapsibleSection>

             <CollapsibleSection
                title="Análisis Histórico de Promedios Mensuales de Falla"
                defaultOpen={true}
                onExport={handleExportHistoricalSummary}
            >
                <div className="space-y-8">
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Promedio Mensual de Fallas Reales por Zona (%s)</h3>
                        <MonthlyEventSummaryChart historicalData={historicalData} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Desglose de Promedio Mensual de Fallas por Zona</h3>
                        <p className="text-sm text-gray-400 mb-2">Haga clic en una fila para ver el detalle de fallas de gabinete para esa zona y mes.</p>
                        <HistoricalSummaryTable 
                            historicalData={historicalData}
                            selected={selectedHistoricalMonthZone}
                            onSelect={setSelectedHistoricalMonthZone}
                        />
                    </div>
                    <div className="pt-4">
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3 capitalize">{cabinetFailuresTitle}</h3>
                        <CabinetFailuresTable data={cabinetFailuresDataToShow} />
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    );
};

export default HistorialTab;
