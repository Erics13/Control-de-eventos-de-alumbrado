import React from 'react';
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
import type { LuminaireEvent } from '../types';

interface EventosTabProps {
    // Data
    baseFilteredEvents: LuminaireEvent[];
    displayEvents: LuminaireEvent[];
    oldestEventsByZone: LuminaireEvent[];
    failureDataByZone: { data: any[]; categories: string[] };
    failureDataByMunicipio: { data: any[]; categories: string[] };
    
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

    // Handlers
    handleCardClick: (filter: string) => void;
    handleExportFailureByZone: () => void;
    handleExportFailureByMunicipio: () => void;
    handleExportFilteredEvents: () => void;
}


const EventosTab: React.FC<EventosTabProps> = ({
    baseFilteredEvents,
    displayEvents,
    oldestEventsByZone,
    failureDataByZone,
    failureDataByMunicipio,
    inaccesibleFailures,
    lowCurrentFailures,
    highCurrentFailures,
    voltageFailures,
    columnaCaidaFailures,
    hurtoFailures,
    vandalizadoFailures,
    cardFilter,
    handleCardClick,
    handleExportFailureByZone,
    handleExportFailureByMunicipio,
    handleExportFilteredEvents,
}) => {
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