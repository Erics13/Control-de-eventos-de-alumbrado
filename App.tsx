

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
import type { LuminaireEvent, InventoryItem } from './types';
import { ALL_ZONES, MUNICIPIO_TO_ZONE_MAP } from './constants';
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
import ChangeEventTable from './components/ChangeEventTable';
import ChangesByZoneChart from './components/ChangesByZoneChart';
import InventoryTable from './components/InventoryTable';
import InventoryByZoneChart from './components/InventoryByZoneChart';
import InventoryByMunicipioChart from './components/InventoryByMunicipioChart';
import PowerSummaryTable from './components/PowerSummaryTable';
import CabinetSummaryTable from './components/CabinetSummaryTable';
import ServiceSummaryTable from './components/ServiceSummaryTable';
import CollapsibleSection from './components/CollapsibleSection';
import { exportToCsv } from './utils/export';
import InauguratedByZoneChart from './components/InauguratedByZoneChart';
import InaugurationsByYearZoneChart from './components/InaugurationsByYearZoneChart';

const ERROR_DESC_LOW_CURRENT = "La corriente medida es menor que lo esperado o no hay corriente que fluya a través de la combinación de driver y lámpara.";
const ERROR_DESC_HIGH_CURRENT = "La corriente medida para la combinación de driver y lámpara es mayor que la esperada.";
const ERROR_DESC_VOLTAGE = "El voltaje de la red eléctrica de entrada detectado del sistema es muy bajo o muy alto. Esto podría llevar a fallas del sistema.";

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

export type ActiveTab = 'eventos' | 'cambios' | 'inventario';

const TabButton: React.FC<{
    tabId: ActiveTab;
    title: string;
    activeTab: ActiveTab;
    setActiveTab: (tabId: ActiveTab) => void;
    disabled?: boolean;
}> = ({ tabId, title, activeTab, setActiveTab, disabled }) => {
    const isActive = activeTab === tabId;
    return (
        <button
            onClick={() => setActiveTab(tabId)}
            disabled={disabled}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
                disabled
                    ? 'text-gray-600 border-transparent cursor-not-allowed'
                    : isActive
                    ? 'border-cyan-500 text-cyan-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
            }`}
            aria-current={isActive ? 'page' : undefined}
        >
            {title}
        </button>
    );
};


const App: React.FC = () => {
    const { allEvents, changeEvents, inventory, uploadedFileNames, addEventsFromCSV, addChangeEventsFromCSV, addInventoryFromCSV, addEventsFromJSON, downloadDataAsJSON, resetApplication, loading, error } = useLuminaireData();
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [selectedZone, setSelectedZone] = useState<string>('all');
    const [selectedMunicipio, setSelectedMunicipio] = useState<string>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedPower, setSelectedPower] = useState<string>('all');
    const [selectedCalendar, setSelectedCalendar] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [cardFilter, setCardFilter] = useState<string | null>(null);
    const [cardChangeFilter, setCardChangeFilter] = useState<string | null>(null);
    const [cardInventoryFilter, setCardInventoryFilter] = useState<{key: keyof InventoryItem, value: string} | null>(null);
    const [isFilelistVisible, setIsFilelistVisible] = useState(true);
    const [isDataManagementVisible, setIsDataManagementVisible] = useState(false);
    const [isFiltersVisible, setIsFiltersVisible] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [activeTab, setActiveTab] = useState<ActiveTab>('inventario');
    const [isInventorySummariesOpen, setIsInventorySummariesOpen] = useState(false);

    const handleCardClick = useCallback((filterType: string) => {
        setCardFilter(prevFilter => (prevFilter === filterType ? null : filterType));
        setCardChangeFilter(null);
        setCardInventoryFilter(null);
    }, []);

    const handleCardChangeClick = useCallback((filterType: string) => {
        setCardChangeFilter(prevFilter => (prevFilter === filterType ? null : filterType));
        setCardFilter(null);
        setCardInventoryFilter(null);
    }, []);

    const handleCardInventoryClick = useCallback((key: keyof InventoryItem, value: string) => {
        setCardInventoryFilter(prevFilter => 
            (prevFilter && prevFilter.key === key && prevFilter.value === value) ? null : { key, value }
        );
        setCardFilter(null);
        setCardChangeFilter(null);
    }, []);

    const handleSetDatePreset = useCallback((preset: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
        setSelectedMonth('');
        setSelectedYear('');
        const now = new Date();
        let start, end;
        switch (preset) {
            case 'today':
                start = startOfDay(now);
                end = endOfDay(now);
                break;
            case 'yesterday':
                const yesterday = subDays(now, 1);
                start = startOfDay(yesterday);
                end = endOfDay(yesterday);
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
    
     useEffect(() => {
        // If the active tab has no data, switch to the first available tab in the preferred order.
        if (loading) return;

        const hasInventory = inventory.length > 0;
        const hasChanges = changeEvents.length > 0;
        const hasEvents = allEvents.length > 0;

        if (activeTab === 'inventario' && !hasInventory) {
            if (hasChanges) setActiveTab('cambios');
            else if (hasEvents) setActiveTab('eventos');
        } else if (activeTab === 'cambios' && !hasChanges) {
            if (hasInventory) setActiveTab('inventario');
            else if (hasEvents) setActiveTab('eventos');
        } else if (activeTab === 'eventos' && !hasEvents) {
            if (hasInventory) setActiveTab('inventario');
            else if (hasChanges) setActiveTab('cambios');
        }
    }, [inventory.length, changeEvents.length, allEvents.length, activeTab, loading]);

     const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            addEventsFromJSON(file);
            event.target.value = ''; // Reset input to allow re-uploading the same file
        }
    };

    const handleChangesFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if(file) {
            addChangeEventsFromCSV(file);
            event.target.value = '';
        }
    };

    const handleInventoryFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if(file) {
            addInventoryFromCSV(file);
            event.target.value = '';
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

    const baseFilteredChangeEvents = useMemo(() => {
        return changeEvents.filter(event => {
            const eventDate = event.fechaRetiro;
            const isDateInRange = !dateRange.start || !dateRange.end || isWithinInterval(eventDate, { start: dateRange.start, end: dateRange.end });
            const isZoneMatch = selectedZone === 'all' || event.zone === selectedZone;
            const isMunicipioMatch = selectedMunicipio === 'all' || event.municipio === selectedMunicipio;
            
            const searchLower = searchTerm.toLowerCase().trim();
            if (searchLower === '') {
                return isDateInRange && isZoneMatch && isMunicipioMatch;
            }
            
            // Normalize by removing colons and all whitespace for a more robust search
            const normalizedSearchTerm = searchLower.replace(/:/g, '').replace(/\s/g, '');

            const isSearchMatch = 
                (event.poleIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) ||
                (event.streetlightIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) ||
                (event.componente || '').toLowerCase().includes(searchLower) ||
                (event.designacionTipo || '').toLowerCase().includes(searchLower) ||
                (event.cabinetIdExterno || '').toLowerCase().includes(searchLower);

            return isDateInRange && isZoneMatch && isMunicipioMatch && isSearchMatch;
        });
    }, [changeEvents, dateRange, selectedZone, selectedMunicipio, searchTerm]);

    const displayInventory = useMemo(() => {
        return inventory.filter(item => {
            // Use the later of the two dates for filtering
            const relevantDate = item.fechaInauguracion && item.fechaInstalacion 
                ? (item.fechaInauguracion > item.fechaInstalacion ? item.fechaInauguracion : item.fechaInstalacion)
                : item.fechaInauguracion || item.fechaInstalacion;

            const isDateInRange = !relevantDate || !dateRange.start || !dateRange.end || isWithinInterval(relevantDate, { start: dateRange.start, end: dateRange.end });
            const isZoneMatch = selectedZone === 'all' || item.zone === selectedZone;
            const isMunicipioMatch = selectedMunicipio === 'all' || item.municipio === selectedMunicipio;
            const isPowerMatch = selectedPower === 'all' || String(item.potenciaNominal) === selectedPower;
            const isCalendarMatch = selectedCalendar === 'all' || item.dimmingCalendar === selectedCalendar;
            return isDateInRange && isZoneMatch && isMunicipioMatch && isPowerMatch && isCalendarMatch;
        });
    }, [inventory, dateRange, selectedZone, selectedMunicipio, selectedPower, selectedCalendar]);
    
    const finalDisplayInventory = useMemo(() => {
        if (!cardInventoryFilter) {
            return displayInventory;
        }
        return displayInventory.filter(item => {
            const itemValue = item[cardInventoryFilter.key];
            if (typeof itemValue !== 'string') {
                return false;
            }

            const filterValue = cardInventoryFilter.value.toUpperCase().trim();
            const processedItemValue = itemValue.toUpperCase().trim();

            if (cardInventoryFilter.key === 'situacion' && filterValue === 'VANDALIZADO') {
                return processedItemValue.startsWith('VANDALIZADO');
            }
            
            return processedItemValue === filterValue;
        });
    }, [displayInventory, cardInventoryFilter]);

    const displayEvents = useMemo(() => {
        if (!cardFilter) {
            return baseFilteredEvents;
        }
        switch (cardFilter) {
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
    
    const displayChangeEvents = useMemo(() => {
        if (!cardChangeFilter) {
            return baseFilteredChangeEvents;
        }
        switch (cardChangeFilter) {
            case 'luminaria':
                return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('LUMINARIA'));
            case 'olc':
                return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('OLC'));
            case 'garantia':
                return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'garantia');
            case 'vandalizado':
                return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'vandalizado');
            case 'columnaCaidaChange':
                return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'columna caída');
            case 'hurtoChange':
                return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'hurto');
            default:
                return baseFilteredChangeEvents;
        }
    }, [baseFilteredChangeEvents, cardChangeFilter]);


    const failureCategories = useMemo(() => {
        const categories = new Set(allEvents
            .map(e => e.failureCategory)
            .filter((c): c is string => !!c)
        );
        return Array.from(categories).sort();
    }, [allEvents]);

    const zones = useMemo(() => {
        const zoneSet = new Set([...allEvents.map(e => e.zone), ...changeEvents.map(e => e.zone), ...inventory.map(i => i.zone)]);
        return Array.from(zoneSet).sort();
    }, [allEvents, changeEvents, inventory]);
    
    const municipios = useMemo(() => {
        const municipioSet = new Set([...allEvents.map(e => e.municipio), ...changeEvents.map(e => e.municipio), ...inventory.map(i => i.municipio)]);
        return Array.from(municipioSet).sort();
    }, [allEvents, changeEvents, inventory]);

    const filteredMunicipios = useMemo(() => {
        if (selectedZone === 'all') {
            return municipios;
        }
        return municipios.filter(m => MUNICIPIO_TO_ZONE_MAP[m.toUpperCase()] === selectedZone);
    }, [selectedZone, municipios]);

    useEffect(() => {
        if (selectedMunicipio !== 'all' && !filteredMunicipios.includes(selectedMunicipio)) {
            setSelectedMunicipio('all');
        }
    }, [selectedZone, filteredMunicipios, selectedMunicipio]);

    const availableYears = useMemo(() => {
        if (allEvents.length === 0) return [];
        const years = new Set<string>();
        allEvents.forEach(event => {
            years.add(format(event.date, 'yyyy'));
        });
        // FIX: Explicitly typed sort parameters to resolve TS error with arithmetic operations.
        return Array.from(years).sort((a: string, b: string) => parseInt(b) - parseInt(a));
    }, [allEvents]);
    
    const availablePowers = useMemo(() => {
        const powers = new Set(inventory.map(i => i.potenciaNominal).filter((p): p is number => p != null));
        // FIX: Explicitly typed sort parameters to resolve TS error with arithmetic operations.
        return Array.from(powers).sort((a: number, b: number) => a - b).map(String);
    }, [inventory]);

    const availableCalendars = useMemo(() => {
        const calendars = new Set(inventory.map(i => i.dimmingCalendar).filter((c): c is string => !!c && c !== '-'));
        return Array.from(calendars).sort();
    }, [inventory]);
    
    // --- Inventory Metrics ---
    const uniqueCabinetCount = useMemo(() => {
        const cabinets = new Set(displayInventory.map(i => i.cabinetIdExterno).filter((c): c is string => !!c && c.trim() !== '' && c.trim() !== '-'));
        return cabinets.size;
    }, [displayInventory]);

    const inauguratedCount = useMemo(() => {
        return displayInventory.filter(item => item.fechaInauguracion).length;
    }, [displayInventory]);

    const markedCount = useMemo(() => {
        return inventory.filter(item => item.marked?.trim().toUpperCase() === 'YES').length;
    }, [inventory]);
    
    const uniqueAccountCount = useMemo(() => {
        const accounts = new Set(displayInventory.map(i => i.nroCuenta).filter((c): c is string => !!c && c.trim() !== '' && c.trim() !== '-'));
        return accounts.size;
    }, [displayInventory]);
    
    const vandalizadoInventoryCount = useMemo(() => 
        displayInventory.filter(item => item.situacion?.toUpperCase().trim().startsWith('VANDALIZADO')).length,
    [displayInventory]);

    const hurtoInventoryCount = useMemo(() => 
        displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'HURTO').length,
    [displayInventory]);

    const columnaCaidaInventoryCount = useMemo(() => 
        displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'COLUMNA CAIDA').length,
    [displayInventory]);

    const faltaPodaInventoryCount = useMemo(() => 
        displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'FALTA Poda').length,
    [displayInventory]);

    const faltaLineaInventoryCount = useMemo(() => 
        displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'FALTA LINEA').length,
    [displayInventory]);

    // --- Event Metrics ---
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

    const luminariaChangesCount = useMemo(() => {
        return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('LUMINARIA')).length;
    }, [baseFilteredChangeEvents]);

    const olcChangesCount = useMemo(() => {
        return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('OLC')).length;
    }, [baseFilteredChangeEvents]);
    
    const garantiaChangesCount = useMemo(() => {
        return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'garantia').length;
    }, [baseFilteredChangeEvents]);

    const vandalizadoChangesCount = useMemo(() => {
        return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'vandalizado').length;
    }, [baseFilteredChangeEvents]);

    const columnaCaidaChangesCount = useMemo(() => {
        return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'columna caída').length;
    }, [baseFilteredChangeEvents]);

    const hurtoChangesCount = useMemo(() => {
        return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'hurto').length;
    }, [baseFilteredChangeEvents]);

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

    // --- Lifted Summary Data Calculations ---
    const cabinetSummaryData = useMemo(() => {
        const cabinetCounts = finalDisplayInventory.reduce((acc, item) => {
            if (item.cabinetIdExterno) {
                acc[item.cabinetIdExterno] = (acc[item.cabinetIdExterno] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(cabinetCounts)
            .map(([cabinetId, luminaireCount]) => ({ cabinetId, luminaireCount }))
            .filter(item => item.cabinetId && item.cabinetId !== '-' && item.cabinetId.trim() !== '');
    }, [finalDisplayInventory]);

    const serviceSummaryData = useMemo(() => {
        const serviceMap = finalDisplayInventory.reduce((acc, item) => {
            if (item.nroCuenta && item.nroCuenta.trim() !== '' && item.nroCuenta.trim() !== '-') {
                const cuenta = item.nroCuenta.trim();
                if (!acc.has(cuenta)) {
                    acc.set(cuenta, { luminaireCount: 0, totalPower: 0 });
                }
                const summary = acc.get(cuenta)!;
                summary.luminaireCount += 1;
                summary.totalPower += item.potenciaNominal || 0;
            }
            return acc;
        }, new Map<string, { luminaireCount: number; totalPower: number }>());

        return Array.from(serviceMap.entries()).map(([nroCuenta, data]) => ({
            nroCuenta,
            luminaireCount: data.luminaireCount,
            totalPower: data.totalPower
        }));
    }, [finalDisplayInventory]);

    const powerSummary = useMemo(() => {
        const items = finalDisplayInventory;
        if (items.length === 0) {
            return { powerData: [], locationColumns: [], columnTotals: {}, grandTotal: 0 };
        }

        const isGroupingByZone = selectedZone === 'all';

        const locationColumns: string[] = isGroupingByZone
            ? ALL_ZONES.filter(zone => items.some(item => item.zone === zone))
            : Array.from(new Set<string>(items.map(item => item.municipio).filter((m): m is string => !!m))).sort();

        const powers: number[] = Array.from(new Set<number>(items.map(item => item.potenciaNominal).filter((p): p is number => p != null))).sort((a, b) => a - b);
        
        const powerMap = new Map<number, Record<string, number>>();

        for (const item of items) {
            if (item.potenciaNominal != null) {
                if (!powerMap.has(item.potenciaNominal)) {
                    powerMap.set(item.potenciaNominal, {});
                }
                const powerRow = powerMap.get(item.potenciaNominal)!;
                const location = isGroupingByZone ? item.zone : item.municipio;
                if (location) {
                    powerRow[location] = (powerRow[location] || 0) + 1;
                }
            }
        }
        
        const powerData = powers.map(power => {
            const rowData = powerMap.get(power) || {};
            const total = locationColumns.reduce((sum, loc) => sum + (rowData[loc] || 0), 0);
            return {
                power: `${power}W`,
                ...rowData,
                total: total,
            };
        });
        
        const columnTotals: Record<string, number> = {};
        let grandTotal = 0;
        locationColumns.forEach(loc => {
            const total = powerData.reduce((sum, row) => sum + ((row as any)[loc] || 0), 0);
            columnTotals[loc] = total;
            grandTotal += total;
        });

        return { powerData, locationColumns, columnTotals, grandTotal };
    }, [finalDisplayInventory, selectedZone]);

    // --- Export Handlers ---
    const handleExportCabinetSummary = useCallback(() => {
        exportToCsv(cabinetSummaryData, 'resumen_gabinetes.csv');
    }, [cabinetSummaryData]);

    const handleExportServiceSummary = useCallback(() => {
        exportToCsv(serviceSummaryData, 'resumen_servicios.csv');
    }, [serviceSummaryData]);

    const handleExportPowerSummary = useCallback(() => {
        const { powerData, locationColumns, columnTotals, grandTotal } = powerSummary;
        if (powerData.length === 0) return;

        const exportData = powerData.map(row => {
            const flatRow: Record<string, any> = { Potencia: row.power };
            locationColumns.forEach(loc => {
                flatRow[loc] = (row as any)[loc] || 0;
            });
            flatRow['Total'] = row.total;
            return flatRow;
        });

        const totalsRow: Record<string, any> = { Potencia: 'Total General' };
        locationColumns.forEach(loc => {
            totalsRow[loc] = columnTotals[loc] || 0;
        });
        totalsRow['Total'] = grandTotal;
        exportData.push(totalsRow);

        exportToCsv(exportData, 'resumen_potencias.csv');
    }, [powerSummary]);
    
    const handleExportPDF = async () => {
        if (allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }
    
        setIsExportingPdf(true);
        
        // Use a timeout to allow React to render the off-screen container
        setTimeout(async () => {
            try {
                const { jsPDF } = window.jspdf;
                const html2canvas = window.html2canvas;
                const doc = new jsPDF('l', 'mm', 'a4');
                let yPos = 20;
                const pageMargin = 15;
                const pageWidth = doc.internal.pageSize.getWidth();
                const contentWidth = pageWidth - pageMargin * 2;
                
                doc.setFontSize(20);
                doc.text("Reporte de Alumbrado Público", pageWidth / 2, yPos, { align: 'center' });
                yPos += 8;
                doc.setFontSize(10);
                doc.text(`Filtros Aplicados - Generado: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
                yPos += 15;

                const addChartToPdf = async (elementId: string, title: string) => {
                    const chartElement = document.getElementById(elementId);
                    if (!chartElement) return;
        
                    const chartHeight = 100; // Estimated height, adjust if needed
                    if (yPos + chartHeight > doc.internal.pageSize.getHeight() - pageMargin) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFontSize(14);
                    doc.text(title, pageMargin, yPos);
                    yPos += 8;
        
                    const canvas = await html2canvas(chartElement, { scale: 2, backgroundColor: '#1f2937' });
                    
                    const imgData = canvas.toDataURL('image/png');
                    const imgProps = doc.getImageProperties(imgData);
                    const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
                    
                    doc.addImage(imgData, 'PNG', pageMargin, yPos, contentWidth, imgHeight);
                    yPos += imgHeight + 10;
                };
                
                // --- INVENTARIO ---
                doc.setFontSize(18);
                doc.textWithLink("Inventario", pageMargin, yPos, {});
                yPos += 10;
                await addChartToPdf('pdf-inventory-indicators', 'Indicadores de Inventario');
                await addChartToPdf('pdf-inventory-zone-chart', 'Inventario por Zona');
                await addChartToPdf('pdf-inventory-municipio-chart', 'Inventario por Municipio');
                await addChartToPdf('pdf-inaugurated-zone-chart', 'Luminarias Inauguradas por Zona');
                await addChartToPdf('pdf-inaugurations-year-zone-chart', 'Inauguraciones por Año y Zona');

                // Power Summary Table with autoTable
                const { powerData, locationColumns, columnTotals, grandTotal } = (() => {
                    const items = finalDisplayInventory;
                    const isGroupingByZone = true; // Always group by zone for the main report
                    const locationColumns: string[] = ALL_ZONES.filter(zone => items.some(item => item.zone === zone));
                    const powers: number[] = Array.from(new Set<number>(items.map(item => item.potenciaNominal).filter((p): p is number => p != null))).sort((a, b) => a - b);
                    const powerMap = new Map<number, Record<string, number>>();
                    for (const item of items) {
                        if (item.potenciaNominal != null) {
                            if (!powerMap.has(item.potenciaNominal)) powerMap.set(item.potenciaNominal, {});
                            const powerRow = powerMap.get(item.potenciaNominal)!;
                            const location = isGroupingByZone ? item.zone : item.municipio;
                            if (location) powerRow[location] = (powerRow[location] || 0) + 1;
                        }
                    }
                    const powerData = powers.map(power => {
                        const rowData = powerMap.get(power) || {};
                        const total = locationColumns.reduce((sum, loc) => sum + (rowData[loc] || 0), 0);
                        return { power: `${power}W`, ...rowData, total: total };
                    });
                    const columnTotals: Record<string, number> = {};
                    let grandTotal = 0;
                    locationColumns.forEach(loc => {
                        const total = powerData.reduce((sum, row) => sum + ((row as any)[loc] || 0), 0);
                        columnTotals[loc] = total; grandTotal += total;
                    });
                    return { powerData, locationColumns, columnTotals, grandTotal };
                })();

                if (powerData.length > 0) {
                    // Estimate height to see if the table fits on the current page.
                    // Row height estimation: 7pt font (2.5mm) + padding. Let's say 4mm per row.
                    // Header/Footer height estimation: 8pt font. Let's say 5mm per row.
                    const titleHeight = 8; // mm for title
                    const titleSpacing = 8; // mm
                    const estimatedTableRowHeight = 4; // mm
                    const estimatedTableHeaderFooterHeight = 5; // mm
                    const estimatedTableHeight = (powerData.length * estimatedTableRowHeight) + (2 * estimatedTableHeaderFooterHeight);
                    const totalSpaceNeeded = titleHeight + titleSpacing + estimatedTableHeight;

                    const pageHeight = doc.internal.pageSize.getHeight();
                    const pageBottom = pageHeight - pageMargin;

                    if (yPos + totalSpaceNeeded > pageBottom) {
                        doc.addPage();
                        yPos = 20; // Reset yPos for the new page
                    }

                    doc.setFontSize(14);
                    doc.text('Resumen de Potencias por Ubicación', pageMargin, yPos);
                    yPos += 8;

                    const head = [['Potencia', ...locationColumns, 'Total']];
                    const body = powerData.map(row => [row.power, ...locationColumns.map(loc => (row as any)[loc] || 0), row.total]);
                    
                    (doc as any).autoTable({
                        head, body, startY: yPos, theme: 'grid',
                        margin: { left: pageMargin },
                        styles: { fontSize: 7, cellPadding: 1.5 },
                        headStyles: { fillColor: [44, 62, 80], fontSize: 8, fontStyle: 'bold' },
                        foot: [['Total', ...locationColumns.map(loc => columnTotals[loc] || 0), grandTotal]],
                        footStyles: { fillColor: [44, 62, 80], fontStyle: 'bold', fontSize: 8 },
                    });
                    yPos = (doc as any).lastAutoTable.finalY + 15;
                }
                
                // --- CAMBIOS ---
                doc.addPage();
                yPos = 20;
                doc.setFontSize(18);
                doc.textWithLink("Cambios", pageMargin, yPos, {});
                yPos += 10;
                await addChartToPdf('pdf-change-indicators', 'Indicadores de Cambios');
                await addChartToPdf('pdf-changes-zone-chart', 'Cambios por Zona');
                
                // --- EVENTOS ---
                doc.addPage();
                yPos = 20;
                doc.setFontSize(18);
                doc.textWithLink("Eventos", pageMargin, yPos, {});
                yPos += 10;
                await addChartToPdf('pdf-event-indicators', 'Indicadores de Eventos');
                await addChartToPdf('pdf-category-chart', 'Eventos por Categoría');
                await addChartToPdf('pdf-special-events-chart', 'Eventos por Hurto, Vandalismo y Caídas');
                await addChartToPdf('pdf-zone-chart', 'Eventos por Zona');
                await addChartToPdf('pdf-municipio-chart', 'Eventos por Municipio');
                
                const dateStr = new Date().toISOString().split('T')[0];
                const zoneStr = selectedZone !== 'all' ? `_${selectedZone.replace(/\s+/g, '_')}` : '';
                doc.save(`reporte_alumbrado${zoneStr}_${dateStr}.pdf`);
        
            } catch (err) {
                console.error("Error exporting to PDF", err);
            } finally {
                setIsExportingPdf(false);
            }
        }, 100);
    };

    const noDataLoaded = !loading && allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0;

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
            {isExportingPdf && (
                <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1100px', backgroundColor: '#111827', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Eventos */}
                    <div id="pdf-event-indicators" className="bg-gray-800 p-4 rounded-xl">
                        <div className="grid grid-cols-4 gap-4">
                            <DashboardCard title="Total Eventos" value={baseFilteredEvents.length.toLocaleString()} />
                            <DashboardCard title="Fallas Bajo Consumo" value={lowCurrentFailures.toLocaleString()} />
                            <DashboardCard title="Fallas Alto Consumo" value={highCurrentFailures.toLocaleString()} />
                            <DashboardCard title="Fallas de Voltaje" value={voltageFailures.toLocaleString()} />
                            <DashboardCard title="Columnas Caídas" value={columnaCaidaFailures.toLocaleString()} />
                            <DashboardCard title="Hurtos" value={hurtoFailures.toLocaleString()} />
                            <DashboardCard title="Vandalizados" value={vandalizadoFailures.toLocaleString()} />
                        </div>
                    </div>
                    <div id="pdf-category-chart" className="bg-gray-800 p-4 rounded-xl"><FailureByCategoryChart data={baseFilteredEvents} /></div>
                    <div id="pdf-special-events-chart" className="bg-gray-800 p-4 rounded-xl"><SpecialEventsChart data={baseFilteredEvents} /></div>
                    <div id="pdf-zone-chart" className="bg-gray-800 p-4 rounded-xl"><FailureByZoneChart data={baseFilteredEvents} /></div>
                    <div id="pdf-municipio-chart" className="bg-gray-800 p-4 rounded-xl"><FailureByMunicipioChart data={baseFilteredEvents} /></div>
                    {/* Cambios */}
                    <div id="pdf-change-indicators" className="bg-gray-800 p-4 rounded-xl">
                         <div className="grid grid-cols-4 gap-4">
                            <DashboardCard title="Total Cambios" value={baseFilteredChangeEvents.length.toLocaleString()} />
                            <DashboardCard title="Cambios de Luminarias" value={luminariaChangesCount.toLocaleString()} />
                            <DashboardCard title="Cambios de OLCs" value={olcChangesCount.toLocaleString()} />
                            <DashboardCard title="Por Garantía" value={garantiaChangesCount.toLocaleString()} />
                            <DashboardCard title="Por Vandalismo" value={vandalizadoChangesCount.toLocaleString()} />
                            <DashboardCard title="Por Columna Caída" value={columnaCaidaChangesCount.toLocaleString()} />
                            <DashboardCard title="Por Hurto" value={hurtoChangesCount.toLocaleString()} />
                        </div>
                    </div>
                    <div id="pdf-changes-zone-chart" className="bg-gray-800 p-4 rounded-xl"><ChangesByZoneChart data={baseFilteredChangeEvents} /></div>
                    {/* Inventario */}
                    <div id="pdf-inventory-indicators" className="bg-gray-800 p-4 rounded-xl">
                        <div className="grid grid-cols-5 gap-4 mb-4">
                            <DashboardCard title="Total Luminarias" value={displayInventory.length.toLocaleString()} />
                            <DashboardCard title="Gabinetes Únicos" value={uniqueCabinetCount.toLocaleString()} />
                            <DashboardCard title="Inauguradas" value={inauguratedCount.toLocaleString()} />
                            <DashboardCard title="Puntos Marcados" value={markedCount.toLocaleString()} />
                            <DashboardCard title="Servicios AP" value={uniqueAccountCount.toLocaleString()} />
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                            <DashboardCard title="Vandalizados" value={vandalizadoInventoryCount.toLocaleString()} />
                            <DashboardCard title="Hurtos" value={hurtoInventoryCount.toLocaleString()} />
                            <DashboardCard title="Columnas Caídas" value={columnaCaidaInventoryCount.toLocaleString()} />
                            <DashboardCard title="Falta Poda" value={faltaPodaInventoryCount.toLocaleString()} />
                            <DashboardCard title="Falta Línea" value={faltaLineaInventoryCount.toLocaleString()} />
                        </div>
                    </div>
                    <div id="pdf-inventory-zone-chart" className="bg-gray-800 p-4 rounded-xl"><InventoryByZoneChart data={finalDisplayInventory} /></div>
                    <div id="pdf-inventory-municipio-chart" className="bg-gray-800 p-4 rounded-xl"><InventoryByMunicipioChart data={finalDisplayInventory} /></div>
                    <div id="pdf-inaugurated-zone-chart" className="bg-gray-800 p-4 rounded-xl"><InauguratedByZoneChart data={finalDisplayInventory} /></div>
                    <div id="pdf-inaugurations-year-zone-chart" className="bg-gray-800 p-4 rounded-xl"><InaugurationsByYearZoneChart data={finalDisplayInventory} /></div>
                </div>
            )}
            <Header
                isDataManagementVisible={isDataManagementVisible}
                onToggleDataManagement={() => setIsDataManagementVisible(v => !v)}
                isFiltersVisible={isFiltersVisible}
                onToggleFilters={() => setIsFiltersVisible(v => !v)}
            />
            <main className="flex-grow container mx-auto px-4 md:px-8 pt-4 overflow-hidden flex flex-col">
                {/* --- FIXED TOP SECTION --- */}
                <div className="flex-shrink-0">
                    {isDataManagementVisible && (
                        <div id="data-management-panel" className="bg-gray-800 shadow-lg rounded-xl p-4 mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-cyan-400 mb-2">Gestión de Datos</h2>
                                <p className="text-gray-400 mb-4">
                                    Carga nuevos datos de eventos, cambios o inventario desde archivos CSV, o gestiona respaldos de tu base de datos en formato JSON.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <FileUpload onFileUpload={addEventsFromCSV} loading={loading} />
                                    <div>
                                        <input
                                            type="file"
                                            id="change-csv-upload-input"
                                            accept=".csv"
                                            onChange={handleChangesFileChange}
                                            className="hidden"
                                            disabled={loading}
                                        />
                                        <button
                                            onClick={() => document.getElementById('change-csv-upload-input')?.click()}
                                            disabled={loading}
                                            className="w-full h-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-3"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 9.5L4 11m0 0l1.5 1.5M4 11h16m-5-5v5h5m-5-1.5l1.5 1.5m0 0L20 9.5" /></svg>
                                            <span>Cargar CSV de Cambios</span>
                                        </button>
                                    </div>
                                    <div>
                                        <input
                                            type="file"
                                            id="inventory-csv-upload-input"
                                            accept=".csv"
                                            onChange={handleInventoryFileChange}
                                            className="hidden"
                                            disabled={loading}
                                        />
                                        <button
                                            onClick={() => document.getElementById('inventory-csv-upload-input')?.click()}
                                            disabled={loading}
                                            className="w-full h-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-3"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2-2H4a2 2 0 01-2-2v-4z" /></svg>
                                            <span>Cargar CSV de Inventario</span>
                                        </button>
                                    </div>
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
                                        disabled={loading || (allEvents.length === 0 && changeEvents.length === 0)}
                                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                        Descargar Respaldo JSON
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        disabled={loading || isExportingPdf || (allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0)}
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
                                    <button
                                        onClick={resetApplication}
                                        disabled={loading || (allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0)}
                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 flex items-center justify-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                        Reiniciar Aplicación
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
                    
                    {isFiltersVisible && (
                        <div id="filters-panel" className="bg-gray-800 shadow-lg rounded-xl p-4 mb-4">
                           <h2 className="text-xl font-bold text-cyan-400 mb-4">Filtros y Análisis</h2>
                            <div className="border-t border-gray-700 pt-4">
                                <FilterControls
                                    activeTab={activeTab}
                                    dateRange={dateRange}
                                    setDateRange={setDateRange}
                                    handleSetDatePreset={handleSetDatePreset}
                                    selectedZone={selectedZone}
                                    setSelectedZone={setSelectedZone}
                                    selectedMunicipio={selectedMunicipio}
                                    setSelectedMunicipio={setSelectedMunicipio}
                                    municipios={filteredMunicipios}
                                    selectedCategory={selectedCategory}
                                    setSelectedCategory={setSelectedCategory}
                                    zones={zones.length > 0 ? zones : ALL_ZONES}
                                    failureCategories={failureCategories}
                                    availableYears={availableYears}
                                    selectedMonth={selectedMonth}
                                    setSelectedMonth={setSelectedMonth}
                                    selectedYear={selectedYear}
                                    setSelectedYear={setSelectedYear}
                                    availablePowers={availablePowers}
                                    selectedPower={selectedPower}
                                    setSelectedPower={setSelectedPower}
                                    availableCalendars={availableCalendars}
                                    selectedCalendar={selectedCalendar}
                                    setSelectedCalendar={setSelectedCalendar}
                                    setSearchTerm={setSearchTerm}
                                />
                            </div>
                        </div>
                    )}

                    <div className="border-b border-gray-700">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                             <TabButton tabId="inventario" title="Inventario" activeTab={activeTab} setActiveTab={setActiveTab} disabled={inventory.length === 0} />
                             <TabButton tabId="cambios" title="Cambios" activeTab={activeTab} setActiveTab={setActiveTab} disabled={changeEvents.length === 0} />
                             <TabButton tabId="eventos" title="Eventos" activeTab={activeTab} setActiveTab={setActiveTab} disabled={allEvents.length === 0} />
                        </nav>
                    </div>
                </div>

                {/* --- SCROLLABLE CONTENT --- */}
                <div className="flex-grow overflow-y-auto pt-4">
                    {loading && <div className="text-center p-8"><p>Cargando datos...</p></div>}
                    
                    {!loading && !noDataLoaded && (
                        <div className="space-y-4">
                            {activeTab === 'eventos' && allEvents.length > 0 && (
                                <>
                                    <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                                        <h2 className="text-xl font-bold text-cyan-400 mb-3">Indicadores de Eventos</h2>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                                            <DashboardCard title="Total Eventos" value={baseFilteredEvents.length.toLocaleString()} />
                                            <DashboardCard title="Fallas Bajo Consumo" value={lowCurrentFailures.toLocaleString()} onClick={() => handleCardClick('lowCurrent')} isActive={cardFilter === 'lowCurrent'} />
                                            <DashboardCard title="Fallas Alto Consumo" value={highCurrentFailures.toLocaleString()} onClick={() => handleCardClick('highCurrent')} isActive={cardFilter === 'highCurrent'} />
                                            <DashboardCard title="Fallas de Voltaje" value={voltageFailures.toLocaleString()} onClick={() => handleCardClick('voltage')} isActive={cardFilter === 'voltage'} />
                                            <DashboardCard title="Columnas Caídas" value={columnaCaidaFailures.toLocaleString()} onClick={() => handleCardClick('columnaCaida')} isActive={cardFilter === 'columnaCaida'}/>
                                            <DashboardCard title="Hurtos" value={hurtoFailures.toLocaleString()} onClick={() => handleCardClick('hurto')} isActive={cardFilter === 'hurto'} />
                                            <DashboardCard title="Vandalizados" value={vandalizadoFailures.toLocaleString()} onClick={() => handleCardClick('vandalizado')} isActive={cardFilter === 'vandalizado'} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div id="category-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Eventos por Categoría</h3>
                                            <FailureByCategoryChart data={baseFilteredEvents} />
                                        </div>
                                        <div id="special-events-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Eventos por Hurto, Vandalismo y Caídas</h3>
                                            <SpecialEventsChart data={baseFilteredEvents} />
                                        </div>
                                    </div>
                                    <div id="zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Eventos por Zona</h3>
                                        <FailureByZoneChart data={baseFilteredEvents} />
                                    </div>
                                    <div id="municipio-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Eventos por Municipio</h3>
                                        <FailureByMunicipioChart data={baseFilteredEvents} />
                                    </div>
                                    <div id="events-by-month-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                        <h3 className="text-lg font-semibold text-cyan-400 mb-3">Volumen de Eventos por Mes</h3>
                                        <EventsByMonthChart data={baseFilteredEvents} />
                                    </div>
                                    <CollapsibleSection title="Registro de Eventos de Falla">
                                        <EventTable events={displayEvents} />
                                    </CollapsibleSection>
                                    <CollapsibleSection title="Eventos Reportados Más Antiguos por Zona">
                                        <OldestEventsByZone data={oldestEventsByZone} />
                                    </CollapsibleSection>
                                </>
                            )}
                            
                            {activeTab === 'cambios' && changeEvents.length > 0 && (
                                <>
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
                                    <div className="grid grid-cols-1 gap-4">
                                        <div id="changes-by-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Cambios por Zona</h3>
                                            <ChangesByZoneChart data={baseFilteredChangeEvents} />
                                        </div>
                                    </div>
                                    <CollapsibleSection 
                                        title="Registro de Cambios"
                                        defaultOpen={true}
                                        extraHeaderContent={
                                            <div className="relative flex items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <input
                                                    type="text"
                                                    placeholder="Buscar en Cambios..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-64 bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-10 text-white focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                                                    aria-label="Buscar en tabla de cambios"
                                                />
                                                {searchTerm && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSearchTerm('');
                                                        }}
                                                        className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-white transition-colors"
                                                        aria-label="Limpiar búsqueda"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        }
                                    >
                                        <ChangeEventTable events={displayChangeEvents} />
                                    </CollapsibleSection>
                                </>
                            )}

                            {activeTab === 'inventario' && inventory.length > 0 && (
                                <>
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
                                            title="Resumen de Potencias por Ubicación"
                                            onExport={handleExportPowerSummary}
                                        >
                                            <PowerSummaryTable summaryData={powerSummary} />
                                        </CollapsibleSection>
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <CollapsibleSection 
                                                title="Resumen de Luminarias por Gabinete"
                                                isOpen={isInventorySummariesOpen}
                                                onToggle={() => setIsInventorySummariesOpen(v => !v)}
                                                onExport={handleExportCabinetSummary}
                                            >
                                                <CabinetSummaryTable data={cabinetSummaryData} />
                                            </CollapsibleSection>
                                            <CollapsibleSection 
                                                title="Resumen de Servicios de Alumbrado"
                                                isOpen={isInventorySummariesOpen}
                                                onToggle={() => setIsInventorySummariesOpen(v => !v)}
                                                onExport={handleExportServiceSummary}
                                            >
                                                <ServiceSummaryTable data={serviceSummaryData} />
                                            </CollapsibleSection>
                                        </div>
                                        <div id="inventory-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Inventario por Zona</h3>
                                            <InventoryByZoneChart data={finalDisplayInventory} />
                                        </div>
                                        <div id="inventory-municipio-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Inventario por Municipio</h3>
                                            <InventoryByMunicipioChart data={finalDisplayInventory} />
                                        </div>
                                        <div id="inaugurated-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Luminarias Inauguradas por Zona</h3>
                                            <InauguratedByZoneChart data={finalDisplayInventory} />
                                        </div>
                                        <div id="inaugurations-by-year-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4">
                                            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Inauguraciones por Año y Zona</h3>
                                            <InaugurationsByYearZoneChart data={finalDisplayInventory} />
                                        </div>
                                    </div>
                                    <CollapsibleSection title="Listado de Inventario">
                                        <InventoryTable items={finalDisplayInventory} />
                                    </CollapsibleSection>
                                </>
                            )}
                        </div>
                    )}

                    {noDataLoaded && (
                        <div className="text-center p-16 bg-gray-800 rounded-lg">
                            <h2 className="text-2xl font-semibold text-gray-300">No hay datos cargados</h2>
                            <p className="text-gray-500 mt-2">Utilice los botones de "Gestión de Datos" para cargar planillas CSV y comenzar el análisis.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;
