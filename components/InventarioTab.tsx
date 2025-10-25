
import React from 'react';
import DashboardCard from './DashboardCard';
import CollapsibleSection from './CollapsibleSection';
import PowerSummaryTable from './PowerSummaryTable';
import OperatingHoursSummaryTable from './OperatingHoursSummaryTable';
import LuminaireDetailTable from './LuminaireDetailTable';
import CabinetSummaryTable from './CabinetSummaryTable';
import ServiceSummaryTable from './ServiceSummaryTable';
import InventoryByZoneChart from './InventoryByZoneChart';
import InventoryByMunicipioChart from './InventoryByMunicipioChart';
import InauguratedByZoneChart from './InauguratedByZoneChart';
import InaugurationsByYearZoneChart from './InaugurationsByYearZoneChart';
import InventoryTable from './InventoryTable';
import type { InventoryItem } from '../types';

interface InventarioTabProps {
    // Data
    displayInventory: InventoryItem[];
    finalDisplayInventory: InventoryItem[];
    powerSummary: any;
    operatingHoursSummary: any[];
    operatingHoursZones: string[];
    operatingHoursDetailData: InventoryItem[];
    cabinetSummaryData: any[];
    serviceSummaryData: any[];

    // Metrics
    uniqueCabinetCount: number;
    inauguratedCount: number;
    markedCount: number;
    uniqueAccountCount: number;
    vandalizadoInventoryCount: number;
    hurtoInventoryCount: number;
    columnaCaidaInventoryCount: number;
    faltaPodaInventoryCount: number;
    faltaLineaInventoryCount: number;

    // State
    selectedZone: string;
    isInventorySummariesOpen: boolean;
    selectedOperatingHoursRange: string | null;
    cardInventoryFilter: { key: keyof InventoryItem; value: string } | null;

    // Handlers
    handleCardInventoryClick: (key: keyof InventoryItem, value: string) => void;
    handleExportPowerSummary: () => void;
    handleExportOperatingHoursSummary: () => void;
    handleExportOperatingHoursDetail: () => void;
    setIsInventorySummariesOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
    handleExportCabinetSummary: () => void;
    handleExportServiceSummary: () => void;
    handleOperatingHoursRowClick: (range: string) => void;
}

const InventarioTab: React.FC<InventarioTabProps> = ({
    displayInventory,
    finalDisplayInventory,
    powerSummary,
    operatingHoursSummary,
    operatingHoursZones,
    operatingHoursDetailData,
    cabinetSummaryData,
    serviceSummaryData,
    uniqueCabinetCount,
    inauguratedCount,
    markedCount,
    uniqueAccountCount,
    vandalizadoInventoryCount,
    hurtoInventoryCount,
    columnaCaidaInventoryCount,
    faltaPodaInventoryCount,
    faltaLineaInventoryCount,
    selectedZone,
    isInventorySummariesOpen,
    selectedOperatingHoursRange,
    cardInventoryFilter,
    handleCardInventoryClick,
    handleExportPowerSummary,
    handleExportOperatingHoursSummary,
    handleExportOperatingHoursDetail,
    setIsInventorySummariesOpen,
    handleExportCabinetSummary,
    handleExportServiceSummary,
    handleOperatingHoursRowClick,
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                <h2 className="text-xl font-bold text-cyan-400 mb-3">Indicadores de Inventario</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <DashboardCard title="Total Luminarias" value={displayInventory.length.toLocaleString()} />
                    <DashboardCard title="Gabinetes Únicos" value={uniqueCabinetCount.toLocaleString()} />
                    <DashboardCard title="Inauguradas" value={inauguratedCount.toLocaleString()} />
                    <DashboardCard title="Puntos Marcados" value={markedCount.toLocaleString()} />
                    <DashboardCard title="Servicios AP" value={uniqueAccountCount.toLocaleString()} />
                    <DashboardCard title="Vandalizados" value={vandalizadoInventoryCount.toLocaleString()} onClick={() => handleCardInventoryClick('situacion', 'Vandalizado')} isActive={cardInventoryFilter?.value === 'Vandalizado'}/>
                    <DashboardCard title="Hurtos" value={hurtoInventoryCount.toLocaleString()} onClick={() => handleCardInventoryClick('situacion', 'Hurto')} isActive={cardInventoryFilter?.value === 'Hurto'}/>
                    <DashboardCard title="Columnas Caídas" value={columnaCaidaInventoryCount.toLocaleString()} onClick={() => handleCardInventoryClick('situacion', 'Columna Caida')} isActive={cardInventoryFilter?.value === 'Columna Caida'}/>
                    <DashboardCard title="Falta Poda" value={faltaPodaInventoryCount.toLocaleString()} onClick={() => handleCardInventoryClick('situacion', 'Falta Poda')} isActive={cardInventoryFilter?.value === 'Falta Poda'}/>
                    <DashboardCard title="Falta Línea" value={faltaLineaInventoryCount.toLocaleString()} onClick={() => handleCardInventoryClick('situacion', 'Falta Linea')} isActive={cardInventoryFilter?.value === 'Falta Linea'}/>
                </div>
            </div>
            <div id="inventory-analysis-section" className="space-y-4">
                <h2 className="text-xl font-bold text-cyan-400">Análisis de Inventario</h2>
                <CollapsibleSection 
                    title={selectedZone === 'all' ? "Resumen de Potencias por Zona" : "Resumen de Potencias por Municipio"}
                    onExport={handleExportPowerSummary}
                >
                    <PowerSummaryTable summaryData={powerSummary} />
                </CollapsibleSection>
                <div className="space-y-4">
                    <CollapsibleSection title="Resumen de Horas de Funcionamiento (Total)" onExport={handleExportOperatingHoursSummary}>
                        <OperatingHoursSummaryTable 
                            data={operatingHoursSummary} 
                            zones={operatingHoursZones}
                            onRowClick={handleOperatingHoursRowClick}
                            selectedRange={selectedOperatingHoursRange}
                        />
                    </CollapsibleSection>
                    
                    {selectedOperatingHoursRange && operatingHoursDetailData.length > 0 && (
                        <CollapsibleSection
                            title={`Detalle de Luminarias para Rango: ${selectedOperatingHoursRange} (${operatingHoursDetailData.length.toLocaleString()})`}
                            onExport={handleExportOperatingHoursDetail}
                            defaultOpen={true}
                        >
                            <LuminaireDetailTable 
                                items={operatingHoursDetailData} 
                            />
                        </CollapsibleSection>
                    )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <CollapsibleSection title="Resumen de Luminarias por Gabinete (Total)" isOpen={isInventorySummariesOpen} onToggle={() => setIsInventorySummariesOpen(v => !v)} onExport={handleExportCabinetSummary}><CabinetSummaryTable data={cabinetSummaryData} /></CollapsibleSection>
                    <CollapsibleSection title="Resumen de Servicios de Alumbrado (Total)" isOpen={isInventorySummariesOpen} onToggle={() => setIsInventorySummariesOpen(v => !v)} onExport={handleExportServiceSummary}><ServiceSummaryTable data={serviceSummaryData} /></CollapsibleSection>
                </div>
                <div id="inventory-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Inventario por Zona</h3><InventoryByZoneChart data={finalDisplayInventory} /></div>
                <div id="inventory-municipio-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Inventario por Municipio</h3><InventoryByMunicipioChart data={finalDisplayInventory} /></div>
                <div id="inaugurated-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Luminarias Inauguradas por Zona</h3><InauguratedByZoneChart data={finalDisplayInventory} /></div>
                <div id="inaugurations-by-year-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Inauguraciones por Año y Zona</h3><InaugurationsByYearZoneChart data={finalDisplayInventory} /></div>
            </div>
            <CollapsibleSection title="Listado de Inventario"><InventoryTable items={finalDisplayInventory} /></CollapsibleSection>
        </div>
    );
};

export default InventarioTab;
