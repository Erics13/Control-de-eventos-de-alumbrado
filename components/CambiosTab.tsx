
import React from 'react';
import DashboardCard from './DashboardCard';
import ChangesByZoneChart from './ChangesByZoneChart';
import CollapsibleSection from './CollapsibleSection';
import ChangesByMunicipioTable from './ChangesByMunicipioTable';
import ChangeEventTable from './ChangeEventTable';
import type { ChangeEvent } from '../types';

interface CambiosTabProps {
    // Data
    baseFilteredChangeEvents: ChangeEvent[];
    displayChangeEvents: ChangeEvent[];
    changesByMunicipioData: any[];

    // Metrics
    luminariaChangesCount: number;
    olcChangesCount: number;
    garantiaChangesCount: number;
    vandalizadoChangesCount: number;
    columnaCaidaChangesCount: number;
    hurtoChangesCount: number;

    // State
    cardChangeFilter: string | null;
    searchTerm: string;
    
    // Handlers
    handleCardChangeClick: (filter: string) => void;
    handleExportChangesByMunicipio: () => void;
    setSearchTerm: (term: string) => void;
}

const CambiosTab: React.FC<CambiosTabProps> = ({
    baseFilteredChangeEvents,
    displayChangeEvents,
    changesByMunicipioData,
    luminariaChangesCount,
    olcChangesCount,
    garantiaChangesCount,
    vandalizadoChangesCount,
    columnaCaidaChangesCount,
    hurtoChangesCount,
    cardChangeFilter,
    searchTerm,
    handleCardChangeClick,
    handleExportChangesByMunicipio,
    setSearchTerm,
}) => {
    return (
        <div className="space-y-6">
            <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                <h2 className="text-xl font-bold text-cyan-400 mb-3">Indicadores de Cambios</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <DashboardCard title="Total Cambios" value={baseFilteredChangeEvents.length.toLocaleString()} />
                    <DashboardCard title="Cambios de Luminarias" value={luminariaChangesCount.toLocaleString()} onClick={() => handleCardChangeClick('luminaria')} isActive={cardChangeFilter === 'luminaria'}/>
                    <DashboardCard title="Cambios de OLCs" value={olcChangesCount.toLocaleString()} onClick={() => handleCardChangeClick('olc')} isActive={cardChangeFilter === 'olc'}/>
                    <DashboardCard title="Por Garantía" value={garantiaChangesCount.toLocaleString()} onClick={() => handleCardChangeClick('garantia')} isActive={cardChangeFilter === 'garantia'}/>
                    <DashboardCard title="Por Vandalismo" value={vandalizadoChangesCount.toLocaleString()} onClick={() => handleCardChangeClick('vandalizado')} isActive={cardChangeFilter === 'vandalizado'}/>
                    <DashboardCard title="Por Columna Caída" value={columnaCaidaChangesCount.toLocaleString()} onClick={() => handleCardChangeClick('columnaCaidaChange')} isActive={cardChangeFilter === 'columnaCaidaChange'}/>
                    <DashboardCard title="Por Hurto" value={hurtoChangesCount.toLocaleString()} onClick={() => handleCardChangeClick('hurtoChange')} isActive={cardChangeFilter === 'hurtoChange'}/>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4"><div id="changes-by-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Cambios por Zona</h3><ChangesByZoneChart data={baseFilteredChangeEvents} /></div></div>
            <CollapsibleSection title="Resumen de Cambios por Municipio" onExport={handleExportChangesByMunicipio}><ChangesByMunicipioTable data={changesByMunicipioData} /></CollapsibleSection>
            <CollapsibleSection title="Registro de Cambios" defaultOpen={true} extraHeaderContent={<div className="relative flex items-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Buscar en Cambios..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-64 bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-10 text-white" />{searchTerm && (<button onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }} className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}</div>}><ChangeEventTable events={displayChangeEvents} /></CollapsibleSection>
        </div>
    );
};

export default CambiosTab;
