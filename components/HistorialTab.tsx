
import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import MonthlyEventSummaryChart from './MonthlyEventSummaryChart';
import HistoricalSummaryTable from './HistoricalSummaryTable';
import DashboardCard from './DashboardCard';
import UniqueFailuresByZoneTable from './UniqueFailuresByZoneTable';
import CabinetFailuresTable from './CabinetFailuresTable';
import type { HistoricalData } from '../types';
import type { CabinetFailureDetail } from './CabinetFailuresTable';

interface HistorialTabProps {
    historicalData: HistoricalData;
    uniqueFailuresInDateRange: number;
    uniqueFailuresByZoneInDateRange: { name: string; count: number }[];
    cabinetFailuresInDateRange: CabinetFailureDetail[];
    dateRange: { start: Date | null; end: Date | null };
    handleExportHistoricalSummary?: () => void;
}


const HistorialTab: React.FC<HistorialTabProps> = ({
    historicalData,
    uniqueFailuresInDateRange,
    uniqueFailuresByZoneInDateRange,
    cabinetFailuresInDateRange,
    dateRange,
    handleExportHistoricalSummary,
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
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Promedio Mensual de Fallas Reales por Zona (%)</h3>
                        <MonthlyEventSummaryChart historicalData={historicalData} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Desglose de Promedio Mensual de Fallas por Zona</h3>
                        <HistoricalSummaryTable historicalData={historicalData} />
                    </div>
                    <div className="pt-4">
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Detalle de Luminarias en Falla de Gabinete</h3>
                        <CabinetFailuresTable data={cabinetFailuresInDateRange} />
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    );
};

export default HistorialTab;