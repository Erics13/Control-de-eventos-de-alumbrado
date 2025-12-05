
import React, { useMemo } from 'react';
import DashboardCard from './DashboardCard';
import FailureByCategoryChart from './FailureByCategoryChart';
import SpecialEventsChart from './SpecialEventsChart';
import FailureByZoneChart from './FailureByZoneChart';
import FailureByMunicipioChart from './FailureByMunicipioChart';
import EventsByMonthChart from './EventsByMonthChart';
import CollapsibleSection from './CollapsibleSection';
import FailurePercentageTable from './FailurePercentageTable';
import EventTable from './EventTable';
import OldestEventsByZone from './OldestEventsByZone';
import FailedCabinetsByZoneTable from './FailedCabinetsByZoneTable';
import FailedCabinetAccountsTable from './FailedCabinetAccountsTable';
import InaccessibleByZoneTable from './InaccessibleByZoneTable';
import InaccessibleByAccountTable from './InaccessibleByAccountTable';
import type { LuminaireEvent, ServicePoint } from '../types';

interface EventosTabProps {
    // Data
    baseFilteredEvents: LuminaireEvent[];
    displayEvents: LuminaireEvent[];
    oldestEventsByZone: LuminaireEvent[];
    failureDataByZone: { data: any[]; categories: string[] };
    failureDataByMunicipio: { data: any[]; categories: string[] };
    servicePoints: ServicePoint[];
    
    // Metrics
    inaccesibleFailures: number;
    lowCurrentFailures: number;
    highCurrentFailures: number;
    voltageFailures: number;
    columnaCaidaFailures: number;
    hurtoFailures: number;
    vandalizadoFailures: number;

    // State
    cardFilter: string | null;
    cabinetFailureAnalysisData: {
        name: string;
        count: number;
        accounts: string[];
    }[];
    selectedZoneForCabinetDetails: string | null;

    // Handlers
    handleCardClick: (filter: string) => void;
    handleExportFailureByZone: () => void;
    handleExportFailureByMunicipio: () => void;
    handleExportFilteredEvents: () => void;
    handleCabinetZoneRowClick: (zoneName: string) => void;
    handleExportCabinetFailureAnalysis: () => void;
    handleOpenMapModal: (zoneName: string) => void;

    // New props for inaccessible luminaires
    totalUniqueInaccessibleLuminaires: number;
    inaccessibleByZoneData: { name: string; count: number }[];
    inaccessibleByAccountData: { nroCuenta: string; count: number; direccion: string; zone: string; municipio: string }[];
}


const EventosTab: React.FC<EventosTabProps> = ({
    baseFilteredEvents,
    displayEvents,
    oldestEventsByZone,
    failureDataByZone,
    failureDataByMunicipio,
    servicePoints,
    inaccesibleFailures,
    lowCurrentFailures,
    highCurrentFailures,
    voltageFailures,
    columnaCaidaFailures,
    hurtoFailures,
    vandalizadoFailures,
    cardFilter,
    cabinetFailureAnalysisData,
    selectedZoneForCabinetDetails,
    handleCabinetZoneRowClick,
    handleCardClick,
    handleExportFailureByZone,
    handleExportFailureByMunicipio,
    handleExportFilteredEvents,
    handleExportCabinetFailureAnalysis,
    handleOpenMapModal,
    totalUniqueInaccessibleLuminaires,
    inaccessibleByZoneData,
    inaccessibleByAccountData,
}) => {
    const selectedZoneData = cabinetFailureAnalysisData.find(d => d.name === selectedZoneForCabinetDetails);
    
    const enrichedAccountDetails = useMemo(() => {
        if (!selectedZoneData || !servicePoints) return [];
        const accounts = new Set(selectedZoneData.accounts);
        return servicePoints.filter(sp => accounts.has(sp.nroCuenta));
    }, [selectedZoneData, servicePoints]);

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                <h2 className="text-xl font-bold text-cyan-400 mb-3">Indicadores de Eventos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <DashboardCard title="Total Eventos" value={baseFilteredEvents.length.toLocaleString()} />
                    <DashboardCard title="Inaccesibles" value={inaccesibleFailures.toLocaleString()} onClick={() => handleCardClick('inaccesible')} isActive={cardFilter === 'inaccesible'} />
                    <DashboardCard title="Fallas Bajo Consumo" value={lowCurrentFailures.toLocaleString()} onClick={() => handleCardClick('lowCurrent')} isActive={cardFilter === 'lowCurrent'} />
                    <DashboardCard title="Fallas Alto Consumo" value={highCurrentFailures.toLocaleString()} onClick={() => handleCardClick('highCurrent')} isActive={cardFilter === 'highCurrent'} />
                    <DashboardCard title="Fallas de Voltaje" value={voltageFailures.toLocaleString()} onClick={() => handleCardClick('voltage')} isActive={cardFilter === 'voltage'} />
                    <DashboardCard title="Columnas Caídas" value={columnaCaidaFailures.toLocaleString()} onClick={() => handleCardClick('columnaCaida')} isActive={cardFilter === 'columnaCaida'}/>
                    <DashboardCard title="Hurtos" value={hurtoFailures.toLocaleString()} onClick={() => handleCardClick('hurto')} isActive={cardFilter === 'hurto'} />
                    <DashboardCard title="Vandalizados" value={vandalizadoFailures.toLocaleString()} onClick={() => handleCardClick('vandalizado')} isActive={cardFilter === 'vandalizado'} />
                </div>
            </div>

             <CollapsibleSection title="Análisis de Tableros con Falla por Zona" defaultOpen onExport={handleExportCabinetFailureAnalysis}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-1">
                        <FailedCabinetsByZoneTable 
                            data={cabinetFailureAnalysisData}
                            onRowClick={handleCabinetZoneRowClick}
                            selectedZone={selectedZoneForCabinetDetails}
                        />
                         <p className="text-xs text-gray-500 mt-2">Un tablero se considera con falla si el 50% o más de sus luminarias asociadas están inaccesibles.</p>
                    </div>
                    <div className="lg:col-span-2">
                        {selectedZoneData ? (
                            <FailedCabinetAccountsTable servicePoints={enrichedAccountDetails} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 rounded-lg bg-gray-900/50 p-4">
                                Haga clic en una fila a la izquierda para ver el listado de servicios con falla.
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Análisis de Luminarias Inaccesibles" defaultOpen={true}>
                <div className="space-y-6">
                    <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                        <h3 className="text-xl font-bold text-cyan-400 mb-3">Indicador General</h3>
                        <DashboardCard 
                            title="Total Luminarias Únicas Inaccesibles" 
                            value={totalUniqueInaccessibleLuminaires.toLocaleString()} 
                            isActive={false} // This card doesn't filter further
                        />
                        <p className="text-sm text-gray-400 mt-2 max-w-lg">
                            Este valor representa el número total de luminarias únicas que reportaron una falla de tipo "Inaccesible" dentro del período de fechas y filtros de ubicación seleccionados.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Luminarias Inaccesibles por Zona</h3>
                            <InaccessibleByZoneTable data={inaccessibleByZoneData} />
                        </div>
                        <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Luminarias Inaccesibles por Cuenta de Servicio</h3>
                            <InaccessibleByAccountTable data={inaccessibleByAccountData} />
                        </div>
                    </div>
                </div>
            </CollapsibleSection>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div id="category-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Eventos por Categoría</h3><FailureByCategoryChart data={baseFilteredEvents} /></div>
                <div id="special-events-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Eventos por Hurto, Vandalismo y Caídas</h3><SpecialEventsChart data={baseFilteredEvents} /></div>
            </div>
            <div id="zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Porcentaje de Fallas por Zona (% del Inventario)</h3><FailureByZoneChart data={failureDataByZone.data} /></div>
            <CollapsibleSection title="Detalle de Eventos por Zona" onExport={handleExportFailureByZone}><FailurePercentageTable data={failureDataByZone.data} categories={failureDataByZone.categories} locationHeader="Zona" /></CollapsibleSection>
            <div id="municipio-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Porcentaje de Fallas por Municipio (% del Inventario)</h3><FailureByMunicipioChart data={failureDataByMunicipio.data} /></div>
            <CollapsibleSection title="Detalle de Fallas por Municipio" onExport={handleExportFailureByMunicipio}><FailurePercentageTable data={failureDataByMunicipio.data} categories={failureDataByMunicipio.categories} locationHeader="Municipio" /></CollapsibleSection>
            <div id="events-by-month-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Volumen de Eventos por Mes (Últimos 12 Meses)</h3><EventsByMonthChart data={baseFilteredEvents} /></div>
            <CollapsibleSection title="Listado de Eventos" onExport={handleExportFilteredEvents}><EventTable events={displayEvents} /></CollapsibleSection>
            <CollapsibleSection title="Eventos Reportados Más Antiguos por Zona"><OldestEventsByZone data={oldestEventsByZone} /></CollapsibleSection>
        </div>
    );
};

export default EventosTab;
