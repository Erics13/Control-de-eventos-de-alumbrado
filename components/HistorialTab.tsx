import React from 'react';
import CollapsibleSection from './CollapsibleSection';
import MonthlyEventSummaryChart from './MonthlyEventSummaryChart';
import HistoricalSummaryTable from './HistoricalSummaryTable';
import MonthlyEventCountsTable from './MonthlyEventCountsTable';
import HistoricalFilterControls from './HistoricalFilterControls';
import type { HistoricalData } from '../types';

interface HistorialTabProps {
    // Historical Data Props
    historicalData: HistoricalData;
    historicalDateRange?: { start: Date | null; end: Date | null };
    setHistoricalDateRange?: (range: { start: Date | null; end: Date | null }) => void;
    historicalYear?: string;
    setHistoricalYear?: (year: string) => void;
    historicalMonth?: string;
    setHistoricalMonth?: (month: string) => void;
    historicalAvailableYears?: string[];
    handleExportHistoricalSummary?: () => void;
}


const HistorialTab: React.FC<HistorialTabProps> = ({
    historicalData,
    historicalDateRange,
    setHistoricalDateRange,
    historicalYear,
    setHistoricalYear,
    historicalMonth,
    setHistoricalMonth,
    historicalAvailableYears,
    handleExportHistoricalSummary,
}) => {
    const isPortal = setHistoricalDateRange === undefined;

    return (
        <div className="space-y-6">
             <CollapsibleSection
                title="Análisis Histórico de Fallas por Zona"
                defaultOpen={true}
                onExport={!isPortal ? handleExportHistoricalSummary : undefined}
                extraHeaderContent={!isPortal && historicalAvailableYears && (
                    <HistoricalFilterControls
                        dateRange={historicalDateRange!}
                        setDateRange={setHistoricalDateRange!}
                        year={historicalYear!}
                        setYear={setHistoricalYear!}
                        month={historicalMonth!}
                        setMonth={setHistoricalMonth!}
                        availableYears={historicalAvailableYears}
                        onClear={() => {
                            setHistoricalDateRange!({ start: null, end: null });
                            setHistoricalYear!('');
                            setHistoricalMonth!('');
                        }}
                    />
                )}
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
                    <div>
                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Cantidad de Eventos de Falla por Mes</h3>
                        <MonthlyEventCountsTable historicalData={historicalData} />
                    </div>
                </div>
            </CollapsibleSection>
        </div>
    );
};

export default HistorialTab;
