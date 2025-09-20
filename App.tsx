import React, { useState, useMemo, useCallback, useEffect } from 'react';
// FIX: Changed date-fns submodule imports from default to named. This resolves the "not callable"
// error, likely caused by an upgrade to date-fns v3+ which uses named exports for submodules.
import { subDays } from 'date-fns/subDays';
import { startOfMonth } from 'date-fns/startOfMonth';
import { startOfYear } from 'date-fns/startOfYear';
import { isWithinInterval } from 'date-fns/isWithinInterval';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { endOfDay } from 'date-fns/endOfDay';
import { endOfMonth } from 'date-fns/endOfMonth';
import { format } from 'date-fns/format';
import { es } from 'date-fns/locale/es';
import { useLuminaireData } from './hooks/useLuminaireData';
import type { LuminaireEvent } from './types';
import { ALL_ZONES } from './constants';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import DashboardCard from './components/DashboardCard';
import FilterControls from './components/FilterControls';
import FailureByCategoryChart from './components/FailureByCategoryChart';
import FailureByZoneChart from './components/FailureByZoneChart';
import FailureByMunicipioChart from './components/FailureByMunicipioChart';
import EventsByMonthChart from './components/EventsByMonthChart';
import SpecialEventsChart from './components/SpecialEventsChart';
import EventTable from './components/EventTable';
import OldestEventsByZone from './components/OldestEventsByZone';

const ERROR_DESC_LOW_CURRENT = "La corriente medida es menor que lo esperado o no hay corriente que fluya a través de la combinación de driver y lámpara.";
const ERROR_DESC_HIGH_CURRENT = "La corriente medida para la combinación de driver y lámpara es mayor que la esperada.";
const ERROR_DESC_VOLTAGE = "El voltaje de la red eléctrica de entrada detectado del sistema es muy bajo o muy alto. Esto podría llevar a fallas del sistema.";

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

const App: React.FC = () => {
    const { allEvents, uploadedFileNames, addEventsFromCSV, addEventsFromJSON, downloadDataAsJSON, resetApplication, loading, error } = useLuminaireData();
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [selectedZone, setSelectedZone] = useState<string>('all');
    const [selectedMunicipio, setSelectedMunicipio] = useState<string>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [cardFilter, setCardFilter] = useState<string | null>(null);
    const [isFilelistVisible, setIsFilelistVisible] = useState(true);
    const [isDataManagementVisible, setIsDataManagementVisible] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const handleCardClick = useCallback((filterType: string) => {
        setCardFilter(prevFilter => (prevFilter === filterType ? null : filterType));
    }, []);

    const handleSetDatePreset = useCallback((preset: 'today' | 'week' | 'month' | 'year') => {
        setSelectedMonth('');
        setSelectedYear('');
        const now = new Date();
        let start, end;
        switch (preset) {
            case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'week':
                end = now;
                start = subDays(now, 7);
                break;
            case 'month':
                end = now;
                start = startOfMonth(now);
                break;
            case 'year':
                end = now;
                start = startOfYear(now);
                break;
        }
        setDateRange({ start, end });
    }, []);
    
    useEffect(() => {
        if (selectedMonth && selectedYear) {
            const yearNum = parseInt(selectedYear);
            const monthNum = parseInt(selectedMonth) - 1; // JS month is 0-indexed
            const start = new Date(yearNum, monthNum, 1);
            const end = endOfMonth(start);
            setDateRange({ start, end });
        }
    }, [selectedMonth, selectedYear]);
    
     const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            addEventsFromJSON(file);
            event.target.value = ''; // Reset input to allow re-uploading the same file
        }
    };

    const baseFilteredEvents = useMemo(() => {
        return allEvents.filter(event => {
            const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
            const isDateInRange = !dateRange.start || !dateRange.end || isWithinInterval(eventDate, { start: dateRange.start, end: dateRange.end });
            const isZoneMatch = selectedZone === 'all' || event.zone === selectedZone;
            const isMunicipioMatch = selectedMunicipio === 'all' || event.municipio === selectedMunicipio;
            const isCategoryMatch = selectedCategory === 'all' || event.failureCategory === selectedCategory;
            return isDateInRange && isZoneMatch && isMunicipioMatch && isCategoryMatch;
        });
    }, [allEvents, dateRange, selectedZone, selectedMunicipio, selectedCategory]);

    const displayEvents = useMemo(() => {
        if (!cardFilter) {
            return baseFilteredEvents;
        }
        switch (cardFilter) {
            case 'totalFailures':
                return baseFilteredEvents.filter(e => e.status === 'FAILURE');
            case 'lowCurrent':
                return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_LOW_CURRENT);
            case 'highCurrent':
                return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_HIGH_CURRENT);
            case 'voltage':
                return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_VOLTAGE);
            case 'columnaCaida':
                return baseFilteredEvents.filter(e => e.failureCategory === 'Columna Caída');
            case 'hurto':
                return baseFilteredEvents.filter(e => e.failureCategory === 'Hurto');
            case 'vandalizado':
                return baseFilteredEvents.filter(e => e.failureCategory === 'Vandalizado');
            default:
                return baseFilteredEvents;
        }
    }, [baseFilteredEvents, cardFilter]);


    const failureCategories = useMemo(() => {
        const categories = new Set(allEvents
            .map(e => e.failureCategory)
            .filter((c): c is string => !!c)
        );
        return Array.from(categories).sort();
    }, [allEvents]);

    const zones = useMemo(() => {
        const zoneSet = new Set(allEvents.map(e => e.zone));
        return Array.from(zoneSet).sort();
    }, [allEvents]);
    
    const municipios = useMemo(() => {
        const municipioSet = new Set(allEvents.map(e => e.municipio));
        return Array.from(municipioSet).sort();
    }, [allEvents]);

    const availableYears = useMemo(() => {
        if (allEvents.length === 0) return [];
        const years = new Set<string>();
        allEvents.forEach(event => {
            years.add(format(event.date, 'yyyy'));
        });
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
    }, [allEvents]);


    const totalFailures = useMemo(() => baseFilteredEvents.filter(e => e.status === 'FAILURE').length, [baseFilteredEvents]);
    const uniqueLuminaires = useMemo(() => new Set(baseFilteredEvents.map(e => e.id)).size, [baseFilteredEvents]);
    const failureRate = useMemo(() => {
         const totalLuminaires = new Set(allEvents.map(e => e.id)).size;
         return totalLuminaires > 0 ? (totalFailures / totalLuminaires) * 100 : 0;
    }, [totalFailures, allEvents]);

    const lowCurrentFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_LOW_CURRENT).length;
    }, [baseFilteredEvents]);

    const highCurrentFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_HIGH_CURRENT).length;
    }, [baseFilteredEvents]);

    const voltageFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_VOLTAGE).length;
    }, [baseFilteredEvents]);

    const columnaCaidaFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.failureCategory === 'Columna Caída').length;
    }, [baseFilteredEvents]);

    const hurtoFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.failureCategory === 'Hurto').length;
    }, [baseFilteredEvents]);

    const vandalizadoFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.failureCategory === 'Vandalizado').length;
    }, [baseFilteredEvents]);

    const oldestEventsByZone = useMemo(() => {
        if (allEvents.length === 0) {
            return [];
        }
        // `allEvents` is sorted by date descending. We iterate from the end to find the oldest events first.
        const oldestEventsMap = new Map<string, LuminaireEvent>();
        for (let i = allEvents.length - 1; i >= 0; i--) {
            const event = allEvents[i];
            if (!oldestEventsMap.has(event.zone)) {
                oldestEventsMap.set(event.zone, event);
            }
        }
        return Array.from(oldestEventsMap.values()).sort((a, b) =>
            a.zone.localeCompare(b.zone)
        );
    }, [allEvents]);

    const handleExportPDF = async () => {
        if (baseFilteredEvents.length === 0) {
            alert("No hay datos para exportar con los filtros actuales.");
            return;
        }
    
        setIsExportingPdf(true);
        try {
            const { jsPDF } = window.jspdf;
            const html2canvas = window.html2canvas;
            const doc = new jsPDF('p', 'mm', 'a4');
    
            let yPos = 20;
            const pageMargin = 15;
            const pageWidth = doc.internal.pageSize.getWidth();
            const contentWidth = pageWidth - pageMargin * 2;
            
            doc.setFontSize(20);
            doc.text("Reporte de Eventos de Alumbrado", pageWidth / 2, yPos, { align: 'center' });
            yPos += 8;
            doc.setFontSize(10);
            doc.text(`Generado: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
            yPos += 15;
    
            doc.setFontSize(14);
            doc.text("Resumen de Métricas", pageMargin, yPos);
            yPos += 6;
            const metricsBody = [
                ['Luminarias Monitoreadas', uniqueLuminaires.toString()],
                ['Fallas por Bajo Consumo', lowCurrentFailures.toString()],
                ['Fallas por Alto Consumo', highCurrentFailures.toString()],
                ['Fallas de Voltaje', voltageFailures.toString()],
                ['Columnas Caídas', columnaCaidaFailures.toString()],
                ['Hurtos', hurtoFailures.toString()],
                ['Vandalizados', vandalizadoFailures.toString()],
            ];
            (doc as any).autoTable({
                head: [['Métrica', 'Valor']],
                body: metricsBody,
                startY: yPos,
                theme: 'grid',
                headStyles: { fillColor: [44, 62, 80] },
                margin: { left: pageMargin }
            });
            yPos = (doc as any).autoTable.previous.finalY + 15;
            
            const SPECIAL_CATEGORIES_FOR_PDF = ["Columna Caída", "Hurto", "Vandalizado"];

            // Technical Categories Table
            const technicalCategoryEvents = baseFilteredEvents.filter(e => 
                e.failureCategory && !SPECIAL_CATEGORIES_FOR_PDF.includes(e.failureCategory)
            );
            const technicalCategoryCounts = technicalCategoryEvents.reduce((acc, event) => {
                if (event.failureCategory) { acc[event.failureCategory] = (acc[event.failureCategory] || 0) + 1; }
                return acc;
            }, {} as Record<string, number>);
            const technicalCategoryTableBody = Object.entries(technicalCategoryCounts).map(([name, value]) => [name, value.toString()]);

            if (technicalCategoryTableBody.length > 0) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                doc.setFontSize(14);
                doc.text("Tabla de Eventos por Categoría (Técnicos)", pageMargin, yPos);
                yPos += 8;
                (doc as any).autoTable({
                    head: [['Categoría', 'Cantidad de Eventos']],
                    body: technicalCategoryTableBody,
                    startY: yPos,
                    theme: 'grid',
                    headStyles: { fillColor: [44, 62, 80] },
                    margin: { left: pageMargin }
                });
                yPos = (doc as any).autoTable.previous.finalY + 10;
            }

            // Special Categories Table
            const specialCategoryEvents = baseFilteredEvents.filter(e => 
                e.failureCategory && SPECIAL_CATEGORIES_FOR_PDF.includes(e.failureCategory)
            );
            const specialCategoryCounts = specialCategoryEvents.reduce((acc, event) => {
                if (event.failureCategory) { acc[event.failureCategory] = (acc[event.failureCategory] || 0) + 1; }
                return acc;
            }, {} as Record<string, number>);
            const specialCategoryTableBody = Object.entries(specialCategoryCounts).map(([name, value]) => [name, value.toString()]);

            if (specialCategoryTableBody.length > 0) {
                if (yPos > 240) { doc.addPage(); yPos = 20; }
                doc.setFontSize(14);
                doc.text("Tabla de Eventos por Hurto, Vandalismo y Caídas", pageMargin, yPos);
                yPos += 8;
                (doc as any).autoTable({
                    head: [['Categoría', 'Cantidad de Eventos']],
                    body: specialCategoryTableBody,
                    startY: yPos,
                    theme: 'grid',
                    headStyles: { fillColor: [44, 62, 80] },
                    margin: { left: pageMargin }
                });
                yPos = (doc as any).autoTable.previous.finalY + 15;
            }

            const addChartToPdf = async (elementId: string, title: string) => {
                const chartElement = document.getElementById(elementId);
                if (!chartElement) return;
    
                const chartHeight = 100;
                if (yPos + chartHeight > doc.internal.pageSize.getHeight() - pageMargin) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFontSize(14);
                doc.text(title, pageMargin, yPos);
                yPos += 8;
    
                const originalBg = chartElement.style.backgroundColor;
                chartElement.style.backgroundColor = 'white';
    
                const canvas = await html2canvas(chartElement, { scale: 2 });
                
                chartElement.style.backgroundColor = originalBg;
    
                const imgData = canvas.toDataURL('image/png');
                const imgProps = doc.getImageProperties(imgData);
                const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                
                doc.addImage(imgData, 'PNG', pageMargin, yPos, contentWidth, imgHeight);
                yPos += imgHeight + 10;
            };
    
            await addChartToPdf('category-chart-container', 'Gráfico de Eventos por Categoría');
            await addChartToPdf('special-events-chart-container', 'Eventos por Hurto, Vandalismo y Caídas');
            await addChartToPdf('zone-chart-container', 'Eventos por Zona');
            await addChartToPdf('municipio-chart-container', 'Eventos por Municipio');
            await addChartToPdf('events-by-month-container', 'Volumen de Eventos por Mes');
            
            const dateStr = new Date().toISOString().split('T')[0];
            doc.save(`reporte_alumbrado_${dateStr}.pdf`);
    
        } catch (err) {
            console.error("Error exporting to PDF", err);
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
            <Header />
            <main className="container mx-auto p-4 md:p-8">
                 <div className="bg-gray-800 shadow-lg rounded-xl mb-8">
                    <div
                        className={`p-6 flex justify-between items-center cursor-pointer hover:bg-gray-700/50 transition-colors ${!isDataManagementVisible ? 'rounded-xl' : 'rounded-t-xl'}`}
                        onClick={() => setIsDataManagementVisible(!isDataManagementVisible)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDataManagementVisible(!isDataManagementVisible); } }}
                        aria-expanded={isDataManagementVisible}
                        aria-controls="data-management-panel"
                    >
                        <h2 className="text-2xl font-bold text-cyan-400">Gestión de Datos</h2>
                        <div className="flex items-center gap-2">
                             <span className="text-sm text-gray-400 sr-only md:not-sr-only">{isDataManagementVisible ? 'Ocultar' : 'Mostrar'}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transform transition-transform duration-300 ${isDataManagementVisible ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                    
                    {isDataManagementVisible && (
                        <div id="data-management-panel" className="px-6 pb-6">
                           <div className="border-t border-gray-700 pt-6">
                                <p className="text-gray-400 mb-6">
                                    Carga nuevos datos desde un archivo CSV o gestiona respaldos de tu base de datos en formato JSON.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <FileUpload onFileUpload={addEventsFromCSV} loading={loading} />
                                    <div>
                                        <input
                                            type="file"
                                            id="json-upload-input"
                                            accept=".json"
                                            onChange={handleJsonFileChange}
                                            className="hidden"
                                            disabled={loading}
                                        />
                                        <button
                                            onClick={() => document.getElementById('json-upload-input')?.click()}
                                            disabled={loading}
                                            className="w-full h-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-3"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                            <span>Cargar Respaldo JSON</span>
                                        </button>
                                    </div>
                                    <button
                                        onClick={downloadDataAsJSON}
                                        disabled={loading || allEvents.length === 0}
                                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        Descargar Respaldo JSON
                                    </button>
                                    <button
                                        onClick={resetApplication}
                                        disabled={loading || allEvents.length === 0}
                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                        Reiniciar Aplicación
                                    </button>
                                     <button
                                        onClick={handleExportPDF}
                                        disabled={loading || isExportingPdf || allEvents.length === 0}
                                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
                                        {isExportingPdf ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                Exportando...
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>
                                                Exportar a PDF
                                            </>
                                        )}
                                    </button>
                                </div>
                                 {error && <p className="text-red-400 mt-4">{error}</p>}
                                 {uploadedFileNames.length > 0 && (
                                    <div className="mt-6 border-t border-gray-700 pt-4">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-semibold text-cyan-400">Planillas Cargadas ({uploadedFileNames.length})</h3>
                                            {uploadedFileNames.length > 1 && (
                                                 <button
                                                    onClick={() => setIsFilelistVisible(!isFilelistVisible)}
                                                    className="p-1 rounded-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                                    aria-expanded={isFilelistVisible}
                                                    aria-controls="file-list"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transform transition-transform duration-300 ${ isFilelistVisible ? 'rotate-180' : '' }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                    <span className="sr-only">{isFilelistVisible ? 'Ocultar lista' : 'Mostrar lista'}</span>
                                                </button>
                                            )}
                                        </div>
                                        {isFilelistVisible && (
                                            <ul id="file-list" className="list-disc list-inside text-gray-400 max-h-32 overflow-y-auto text-sm space-y-1 bg-gray-900/50 p-3 rounded-md mt-2">
                                                {uploadedFileNames.map(name => <li key={name}>{name}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <DashboardCard title="Luminarias Monitoreadas" value={uniqueLuminaires.toString()} />
                    <DashboardCard 
                        title="Total de Fallas (en período)" 
                        value={totalFailures.toString()} 
                        onClick={() => handleCardClick('totalFailures')}
                        isActive={cardFilter === 'totalFailures'}
                    />
                    <DashboardCard title="Tasa de Falla (histórica)" value={`${failureRate.toFixed(2)}%`} />
                    <DashboardCard 
                        title="Fallas por Bajo Consumo" 
                        value={lowCurrentFailures.toString()} 
                        onClick={() => handleCardClick('lowCurrent')}
                        isActive={cardFilter === 'lowCurrent'}
                    />
                    <DashboardCard 
                        title="Fallas por Alto Consumo" 
                        value={highCurrentFailures.toString()} 
                        onClick={() => handleCardClick('highCurrent')}
                        isActive={cardFilter === 'highCurrent'}
                    />
                    <DashboardCard 
                        title="Fallas de Voltaje" 
                        value={voltageFailures.toString()} 
                        onClick={() => handleCardClick('voltage')}
                        isActive={cardFilter === 'voltage'}
                    />
                    <DashboardCard 
                        title="Columnas Caídas" 
                        value={columnaCaidaFailures.toString()} 
                        onClick={() => handleCardClick('columnaCaida')}
                        isActive={cardFilter === 'columnaCaida'}
                    />
                    <DashboardCard 
                        title="Hurtos" 
                        value={hurtoFailures.toString()} 
                        onClick={() => handleCardClick('hurto')}
                        isActive={cardFilter === 'hurto'}
                    />
                    <DashboardCard 
                        title="Vandalizados" 
                        value={vandalizadoFailures.toString()} 
                        onClick={() => handleCardClick('vandalizado')}
                        isActive={cardFilter === 'vandalizado'}
                    />
                </div>

                <div className="bg-gray-800 shadow-lg rounded-xl p-6 mb-8">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4">Filtros y Análisis</h2>
                    <FilterControls
                        dateRange={dateRange}
                        setDateRange={setDateRange}
                        handleSetDatePreset={handleSetDatePreset}
                        selectedZone={selectedZone}
                        setSelectedZone={setSelectedZone}
                        selectedMunicipio={selectedMunicipio}
                        setSelectedMunicipio={setSelectedMunicipio}
                        municipios={municipios}
                        selectedCategory={selectedCategory}
                        setSelectedCategory={setSelectedCategory}
                        zones={zones.length > 0 ? zones : ALL_ZONES}
                        failureCategories={failureCategories}
                        availableYears={availableYears}
                        selectedMonth={selectedMonth}
                        setSelectedMonth={setSelectedMonth}
                        selectedYear={selectedYear}
                        setSelectedYear={setSelectedYear}
                    />
                </div>

                {baseFilteredEvents.length > 0 ? (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                            <div id="category-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-6">
                                <h3 className="text-xl font-semibold text-cyan-400 mb-4">Eventos por Categoría</h3>
                                <FailureByCategoryChart data={displayEvents} />
                            </div>
                            <div id="special-events-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-6">
                                <h3 className="text-xl font-semibold text-cyan-400 mb-4">Eventos por Hurto, Vandalismo y Caídas</h3>
                                <SpecialEventsChart data={displayEvents} />
                            </div>
                            <div id="zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-6 lg:col-span-2">
                                <h3 className="text-xl font-semibold text-cyan-400 mb-4">Eventos por Zona</h3>
                                <FailureByZoneChart data={displayEvents} />
                            </div>
                            <div id="municipio-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-6 lg:col-span-2">
                                <h3 className="text-xl font-semibold text-cyan-400 mb-4">Eventos por Municipio</h3>
                                <FailureByMunicipioChart data={displayEvents} />
                            </div>
                        </div>
                        
                        <div id="events-by-month-container" className="bg-gray-800 shadow-lg rounded-xl p-6 mb-8">
                            <h3 className="text-xl font-semibold text-cyan-400 mb-4">Volumen de Eventos por Mes</h3>
                            <EventsByMonthChart data={allEvents} />
                        </div>

                        <OldestEventsByZone data={oldestEventsByZone} />

                        <div className="bg-gray-800 shadow-lg rounded-xl p-6">
                           <h3 className="text-xl font-semibold text-cyan-400 mb-4">Registro de Eventos</h3>
                           <EventTable events={displayEvents} />
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16 bg-gray-800 rounded-xl">
                        <h2 className="text-2xl font-bold text-gray-400">No hay datos para mostrar</h2>
                        <p className="text-gray-500 mt-2">Carga un archivo CSV o ajusta los filtros para comenzar.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;