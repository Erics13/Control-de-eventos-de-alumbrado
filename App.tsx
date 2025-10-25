

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
import { endOfYear } from 'date-fns/endOfYear';
import { format } from 'date-fns/format';
import { es } from 'date-fns/locale/es';
import { useLuminaireData } from './hooks/useLuminaireData';
import type { LuminaireEvent, InventoryItem } from './types';
import { ALL_ZONES, MUNICIPIO_TO_ZONE_MAP, ZONE_ORDER } from './constants';
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
import { exportToXlsx } from './utils/export';
import InauguratedByZoneChart from './components/InauguratedByZoneChart';
import InaugurationsByYearZoneChart from './components/InaugurationsByYearZoneChart';
import FailurePercentageTable from './components/FailurePercentageTable';
import OperatingHoursSummaryTable from './components/OperatingHoursSummaryTable';
import ChangesByMunicipioTable from './components/ChangesByMunicipioTable';
import LuminaireDetailTable from './components/LuminaireDetailTable';

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
    const { 
        allEvents, changeEvents, inventory, 
        uploadedFileNames, 
        addEventsFromCSV, addChangeEventsFromCSV, addInventoryFromCSV, 
        addEventsFromJSON, downloadDataAsJSON, 
        deleteDataByFileName, resetApplication, 
        loading, error 
    } = useLuminaireData();

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
    const [selectedOperatingHoursRange, setSelectedOperatingHoursRange] = useState<string | null>(null);

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
        } else if (selectedYear && !selectedMonth) {
            const yearNum = parseInt(selectedYear);
            const start = startOfYear(new Date(yearNum, 0, 1));
            const end = endOfYear(new Date(yearNum, 11, 31));
            setDateRange({ start, end });
        } else if (!selectedYear && selectedMonth) {
            // Month only is selected, clear date range to let filter logic in useMemo handle it
            setDateRange({ start: null, end: null });
        }
    }, [selectedMonth, selectedYear]);
    
    useEffect(() => {
        if (loading) return;

        const hasInventory = inventory.length > 0;
        const hasChanges = changeEvents.length > 0;
        const hasEvents = allEvents.length > 0;

        const tabs: { id: ActiveTab; hasData: boolean }[] = [
            { id: 'inventario', hasData: hasInventory },
            { id: 'cambios', hasData: hasChanges },
            { id: 'eventos', hasData: hasEvents },
        ];
        
        const currentTab = tabs.find(t => t.id === activeTab);

        if (currentTab && !currentTab.hasData) {
            const firstAvailableTab = tabs.find(t => t.hasData);
            if (firstAvailableTab) {
                setActiveTab(firstAvailableTab.id as ActiveTab);
            }
        } else if (!hasInventory && !hasChanges && !hasEvents) {
            // Default to inventory if nothing is loaded
            setActiveTab('inventario');
        }
    }, [inventory.length, changeEvents.length, allEvents.length, activeTab, loading]);


     const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            addEventsFromJSON(file);
            event.target.value = '';
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

    const handleDeleteData = async (fileName: string) => {
        if (window.confirm(`¿Estás seguro de que quieres borrar todos los datos del archivo "${fileName}"? Esta acción no se puede deshacer.`)) {
            await deleteDataByFileName(fileName);
        }
    };

    const baseFilteredEvents = useMemo(() => {
        return allEvents.filter(event => {
            const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date;
            
            let isDateInRange = true;
            if (dateRange.start && dateRange.end) {
                isDateInRange = isWithinInterval(eventDate, { start: dateRange.start, end: dateRange.end });
            } else if (selectedMonth && !selectedYear) {
                isDateInRange = (eventDate.getMonth() + 1) === parseInt(selectedMonth, 10);
            }

            const isZoneMatch = selectedZone === 'all' || event.zone === selectedZone;
            const isMunicipioMatch = selectedMunicipio === 'all' || event.municipio === selectedMunicipio;
            const isCategoryMatch = selectedCategory === 'all' || event.failureCategory === selectedCategory;
            return isDateInRange && isZoneMatch && isMunicipioMatch && isCategoryMatch;
        });
    }, [allEvents, dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear]);

    const baseFilteredChangeEvents = useMemo(() => {
        return changeEvents.filter(event => {
            const eventDate = event.fechaRetiro;
            
            let isDateInRange = true;
            if (dateRange.start && dateRange.end) {
                isDateInRange = isWithinInterval(eventDate, { start: dateRange.start, end: dateRange.end });
            } else if (selectedMonth && !selectedYear) {
                isDateInRange = (eventDate.getMonth() + 1) === parseInt(selectedMonth, 10);
            }
            
            const isZoneMatch = selectedZone === 'all' || event.zone === selectedZone;
            const isMunicipioMatch = selectedMunicipio === 'all' || event.municipio === selectedMunicipio;
            
            const searchLower = searchTerm.toLowerCase().trim();
            if (searchLower === '') {
                return isDateInRange && isZoneMatch && isMunicipioMatch;
            }
            
            const normalizedSearchTerm = searchLower.replace(/:/g, '').replace(/\s/g, '');

            const isSearchMatch = 
                (event.poleIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) ||
                (event.streetlightIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) ||
                (event.componente || '').toLowerCase().includes(searchLower) ||
                (event.designacionTipo || '').toLowerCase().includes(searchLower) ||
                (event.cabinetIdExterno || '').toLowerCase().includes(searchLower);

            return isDateInRange && isZoneMatch && isMunicipioMatch && isSearchMatch;
        });
    }, [changeEvents, dateRange, selectedZone, selectedMunicipio, searchTerm, selectedMonth, selectedYear]);

    const displayInventory = useMemo(() => {
        return inventory.filter(item => {
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
            case 'inaccesible':
                return baseFilteredEvents.filter(e => e.failureCategory === 'Inaccesible');
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
        if (allEvents.length === 0 && changeEvents.length === 0) return [];
        const years = new Set<string>();
        allEvents.forEach(event => {
            years.add(format(event.date, 'yyyy'));
        });
        changeEvents.forEach(event => {
            years.add(format(event.fechaRetiro, 'yyyy'));
        });
        return Array.from(years).sort((a: string, b: string) => parseInt(b) - parseInt(a));
    }, [allEvents, changeEvents]);
    
    const availablePowers = useMemo(() => {
        const powers = new Set(inventory.map(i => i.potenciaNominal).filter((p): p is number => p != null));
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
        displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'FALTA PODA').length,
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

    const inaccesibleFailures = useMemo(() => {
        return baseFilteredEvents.filter(e => e.failureCategory === 'Inaccesible').length;
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

    const inventoryCountByZone = useMemo(() => {
        return inventory.reduce((acc, item) => {
            if (item.zone) {
                acc[item.zone] = (acc[item.zone] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [inventory]);

    const inventoryCountByMunicipio = useMemo(() => {
        return inventory.reduce((acc, item) => {
            if (item.municipio) {
                acc[item.municipio] = (acc[item.municipio] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
    }, [inventory]);

    const filteredFailureCategories = useMemo(() => {
        const desiredCategoryOrder = ['Inaccesible', 'Roto', 'Error de configuración', 'Falla de hardware', 'Falla de voltaje', 'Hurto', 'Vandalizado', 'Columna Caída'];
        const allCats = Array.from(new Set(baseFilteredEvents
            .map(e => e.failureCategory)
            .filter((c): c is string => !!c)
        ));

        return allCats.sort((a, b) => {
            const indexA = desiredCategoryOrder.indexOf(a);
            const indexB = desiredCategoryOrder.indexOf(b);
            // if both are in the desired order, sort by it
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // if only one is, it comes first
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // otherwise, sort alphabetically for any other categories
            return a.localeCompare(b);
        });
    }, [baseFilteredEvents]);

    const failureDataByZone = useMemo(() => {
        if (Object.keys(inventoryCountByZone).length === 0) {
            return { data: [], categories: [] };
        }

        const zoneEventCounts = baseFilteredEvents.reduce((acc, event) => {
            const zone = event.zone;
            if (!acc[zone]) {
                acc[zone] = { total: 0, categories: {} };
            }
            acc[zone].total++;
            if (event.failureCategory) {
                acc[zone].categories[event.failureCategory] = (acc[zone].categories[event.failureCategory] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, { total: number; categories: Record<string, number> }>);
        
        const zonesWithInventory = Object.keys(inventoryCountByZone);

        const unsortedData = zonesWithInventory.map(zoneName => {
            const eventData = zoneEventCounts[zoneName] || { total: 0, categories: {} };
            const eventos = eventData.total;
            const totalInventario = inventoryCountByZone[zoneName];
            const porcentaje = totalInventario > 0 ? (eventos / totalInventario) * 100 : 0;
            
            const categoryCounts: Record<string, number> = {};
            filteredFailureCategories.forEach(cat => {
                categoryCounts[cat] = eventData.categories[cat] || 0;
            });

            return {
                name: zoneName,
                eventos,
                totalInventario,
                porcentaje,
                ...categoryCounts,
            };
        });
        
        // FIX: Explicitly type `a` and `b` in the sort function to resolve type errors.
        const sortedData = unsortedData.sort((a: { name: string }, b: { name: string }) => {
            const indexA = ZONE_ORDER.indexOf(a.name);
            const indexB = ZONE_ORDER.indexOf(b.name);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
        
        return { data: sortedData, categories: filteredFailureCategories };
    }, [baseFilteredEvents, inventoryCountByZone, filteredFailureCategories]);

    const failureDataByMunicipio = useMemo(() => {
        if (Object.keys(inventoryCountByMunicipio).length === 0) {
            return { data: [], categories: [] };
        }

        const municipioEventCounts = baseFilteredEvents.reduce((acc, event) => {
            const municipio = event.municipio;
             if (!acc[municipio]) {
                acc[municipio] = { total: 0, categories: {} };
            }
            acc[municipio].total++;
            if (event.failureCategory) {
                acc[municipio].categories[event.failureCategory] = (acc[municipio].categories[event.failureCategory] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, { total: number; categories: Record<string, number> }>);
        
        const municipiosWithInventory = Object.keys(inventoryCountByMunicipio);

        const data = municipiosWithInventory.map(municipioName => {
            const eventData = municipioEventCounts[municipioName] || { total: 0, categories: {} };
            const eventos = eventData.total;
            const totalInventario = inventoryCountByMunicipio[municipioName];
            const porcentaje = totalInventario > 0 ? (eventos / totalInventario) * 100 : 0;

            const categoryCounts: Record<string, number> = {};
            filteredFailureCategories.forEach(cat => {
                categoryCounts[cat] = eventData.categories[cat] || 0;
            });

            return {
                name: municipioName,
                eventos,
                totalInventario,
                porcentaje,
                ...categoryCounts,
            };
        })
        .sort((a, b) => b.porcentaje - a.porcentaje);
        
        return { data, categories: filteredFailureCategories };
    }, [baseFilteredEvents, inventoryCountByMunicipio, filteredFailureCategories]);

    const changesByMunicipioData = useMemo(() => {
        const counts = baseFilteredChangeEvents.reduce((acc, event) => {
            if (!event.municipio) return acc;
            
            if (!acc[event.municipio]) {
                acc[event.municipio] = { LUMINARIA: 0, OLC: 0, total: 0 };
            }

            const component = event.componente.toUpperCase();
            if (component.includes('LUMINARIA')) {
                acc[event.municipio].LUMINARIA++;
                acc[event.municipio].total++;
            } else if (component.includes('OLC')) {
                acc[event.municipio].OLC++;
                acc[event.municipio].total++;
            }
            return acc;
        }, {} as Record<string, { LUMINARIA: number; OLC: number; total: number }>);
        
        return Object.entries(counts)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);

    }, [baseFilteredChangeEvents]);

    // --- Lifted Summary Data Calculations ---
    const cabinetSummaryData = useMemo(() => {
        const cabinetCounts = inventory.reduce((acc, item) => {
            if (item.cabinetIdExterno) {
                acc[item.cabinetIdExterno] = (acc[item.cabinetIdExterno] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(cabinetCounts)
            .map(([cabinetId, luminaireCount]) => ({ cabinetId, luminaireCount }))
            .filter(item => item.cabinetId && item.cabinetId !== '-' && item.cabinetId.trim() !== '');
    }, [inventory]);

    const serviceSummaryData = useMemo(() => {
        const serviceMap = inventory.reduce((acc, item) => {
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
    }, [inventory]);

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
            // FIX: Ensure rowData is an object before spreading by providing a fallback empty object.
            const rowData: Record<string, number> = powerMap.get(power) || {};
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

    const { operatingHoursSummary, operatingHoursZones } = useMemo(() => {
        const items = inventory;
        if (items.length === 0) {
            return { operatingHoursSummary: [], operatingHoursZones: [] };
        }

        const RANGE_STEP = 5000;
        const MAX_HOURS = 100000;

        const presentZones = new Set<string>();

        const countsByRange = items.reduce((acc, item) => {
            if (item.horasFuncionamiento != null && item.horasFuncionamiento >= 0 && item.zone) {
                let rangeLabel;

                if (item.horasFuncionamiento > MAX_HOURS) {
                    rangeLabel = `> ${MAX_HOURS.toLocaleString('es-ES')} hs`;
                } else if (item.horasFuncionamiento <= RANGE_STEP) {
                    rangeLabel = `0 - ${RANGE_STEP.toLocaleString('es-ES')} hs`;
                } else {
                    const rangeIndex = Math.floor((item.horasFuncionamiento - 1) / RANGE_STEP);
                    const rangeStart = rangeIndex * RANGE_STEP + 1;
                    const rangeEnd = (rangeIndex + 1) * RANGE_STEP;
                    rangeLabel = `${rangeStart.toLocaleString('es-ES')} - ${rangeEnd.toLocaleString('es-ES')} hs`;
                }
                
                if (!acc[rangeLabel]) {
                    acc[rangeLabel] = { total: 0 };
                }

                acc[rangeLabel].total = (acc[rangeLabel].total || 0) + 1;
                acc[rangeLabel][item.zone] = (acc[rangeLabel][item.zone] || 0) + 1;
                presentZones.add(item.zone);
            }
            return acc;
        }, {} as Record<string, { total: number; [zone: string]: number }>);
        
        const sortedZones = Array.from(presentZones).sort((a, b) => {
            const indexA = ZONE_ORDER.indexOf(a);
            const indexB = ZONE_ORDER.indexOf(b);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.localeCompare(b);
        });

        const summary = Object.entries(countsByRange).map(([range, counts]) => ({
            range,
            ...counts,
        }));
        
        return { operatingHoursSummary: summary, operatingHoursZones: sortedZones };
    }, [inventory]);

    const handleOperatingHoursRowClick = useCallback((range: string) => {
        setSelectedOperatingHoursRange(prev => (prev === range ? null : range));
    }, []);

    const operatingHoursDetailData = useMemo((): InventoryItem[] => {
        if (!selectedOperatingHoursRange) {
            return [];
        }

        const parseRange = (rangeStr: string): { start: number; end: number } => {
            if (rangeStr.startsWith('>')) {
                const start = parseInt(rangeStr.replace(/\D/g, ''), 10);
                return { start, end: Infinity };
            }
            const parts = rangeStr.replace(/ hs/g, '').replace(/\./g, '').split(' - ');
            return {
                start: parseInt(parts[0], 10),
                end: parseInt(parts[1], 10),
            };
        };
        
        const { start, end } = parseRange(selectedOperatingHoursRange);

        return inventory.filter(item => {
            if (item.horasFuncionamiento == null) return false;
            if (end === Infinity) {
                return item.horasFuncionamiento > start;
            }
            return item.horasFuncionamiento >= start && item.horasFuncionamiento <= end;
        });
        
    }, [inventory, selectedOperatingHoursRange]);
    
    // --- Export Handlers ---
    const generateExportFilename = useCallback((baseName: string): string => {
        const dateStr = new Date().toISOString().split('T')[0];
        const zoneStr = selectedZone !== 'all' ? `_${selectedZone.replace(/\s+/g, '_')}` : '';
        const municipioStr = selectedMunicipio !== 'all' ? `_${selectedMunicipio.replace(/\s+/g, '_')}` : '';

        return `${baseName}${zoneStr}${municipioStr}_${dateStr}.xlsx`;
    }, [selectedZone, selectedMunicipio]);

    const handleExportCabinetSummary = useCallback(() => {
        exportToXlsx(cabinetSummaryData, generateExportFilename('resumen_gabinetes'));
    }, [cabinetSummaryData, generateExportFilename]);

    const handleExportServiceSummary = useCallback(() => {
        exportToXlsx(serviceSummaryData, generateExportFilename('resumen_servicios'));
    }, [serviceSummaryData, generateExportFilename]);

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

        exportToXlsx(exportData, generateExportFilename('resumen_potencias'));
    }, [powerSummary, generateExportFilename]);

    const handleExportFailureByZone = useCallback(() => {
        const { data: dataToExport, categories } = failureDataByZone;
        if (dataToExport.length === 0) return;

        const dataForSheet = dataToExport.map(item => {
            const row: Record<string, any> = {
                'Zona': item.name,
                'Porcentaje Fallas (%)': item.porcentaje.toFixed(2),
                'Total Fallas': item.eventos,
                'Total Inventario': item.totalInventario,
            };
            categories.forEach(cat => {
                row[cat] = item[cat] || 0;
            });
            return row;
        });

        exportToXlsx(dataForSheet, generateExportFilename('fallas_por_zona'));
    }, [failureDataByZone, generateExportFilename]);

    const handleExportFailureByMunicipio = useCallback(() => {
        const { data: dataToExport, categories } = failureDataByMunicipio;
        if (dataToExport.length === 0) return;
        
        const dataForSheet = dataToExport.map(item => {
            const row: Record<string, any> = {
                'Municipio': item.name,
                'Porcentaje Fallas (%)': item.porcentaje.toFixed(2),
                'Total Fallas': item.eventos,
                'Total Inventario': item.totalInventario,
            };
            categories.forEach(cat => {
                row[cat] = item[cat] || 0;
            });
            return row;
        });

        exportToXlsx(dataForSheet, generateExportFilename('fallas_por_municipio'));
    }, [failureDataByMunicipio, generateExportFilename]);

    const handleExportChangesByMunicipio = useCallback(() => {
        exportToXlsx(changesByMunicipioData, generateExportFilename('cambios_por_municipio'));
    }, [changesByMunicipioData, generateExportFilename]);

    const handleExportFilteredEvents = useCallback(() => {
        if (displayEvents.length === 0) return;
        const dataForExport = displayEvents.map(event => ({
            'Fecha': event.date.toLocaleString('es-ES'),
            'ID Luminaria': event.id,
            'ID OLC': event.olcId,
            'Municipio': event.municipio,
            'Zona': event.zone,
            'Estado': event.status,
            'Categoría de Falla': event.failureCategory,
            'Descripción': event.description,
            'Potencia': event.power,
            'Latitud': event.lat,
            'Longitud': event.lon,
        }));
        const filename = generateExportFilename(`eventos_${cardFilter?.replace(/\s+/g, '_') || 'filtrados'}`);
        exportToXlsx(dataForExport, filename);
    }, [displayEvents, cardFilter, generateExportFilename]);
    
    const handleExportOperatingHoursSummary = useCallback(() => {
        if (operatingHoursSummary.length === 0) return;
        
        const getRangeStart = (rangeStr: string): number => {
            if (rangeStr.startsWith('>')) return Infinity;
            return parseInt(rangeStr.split(' ')[0].replace(/\D/g, ''), 10);
        };

        const dataToExport = [...operatingHoursSummary]
            .sort((a, b) => getRangeStart(a.range) - getRangeStart(b.range))
            .map(item => {
                const row: Record<string, any> = {
                    'Rango de Horas': item.range,
                    'Total Luminarias': item.total,
                };
                operatingHoursZones.forEach(zone => {
                    row[zone] = item[zone] || 0;
                });
                return row;
            });

        exportToXlsx(dataToExport, generateExportFilename('resumen_horas_funcionamiento'));
    }, [operatingHoursSummary, operatingHoursZones, generateExportFilename]);
    
    const handleExportOperatingHoursDetail = useCallback(() => {
        if (operatingHoursDetailData.length === 0 || !selectedOperatingHoursRange) return;
        
        const filename = generateExportFilename(`detalle_luminarias_rango_${selectedOperatingHoursRange.replace(/[^\w]/g, '_')}`);
        
        const dataForExport = operatingHoursDetailData.map(item => ({
            'ID de luminaria': item.streetlightIdExterno,
            'Dirección Hardware OLC': item.olcHardwareDir ?? 'N/A',
            'Municipio': item.municipio,
            'Latitud': item.lat ?? 'N/A',
            'Longitud': item.lon ?? 'N/A'
        }));

        exportToXlsx(dataForExport, filename);

    }, [operatingHoursDetailData, selectedOperatingHoursRange, generateExportFilename]);

    const handleExportPDF = async () => {
        if (allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }
    
        setIsExportingPdf(true);
        
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
        
                    const chartHeight = 100;
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

                const { powerData, locationColumns, columnTotals, grandTotal } = (() => {
                    const items = finalDisplayInventory;
                    const isGroupingByZone = true;
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
                        // FIX: Ensure rowData is an object before spreading by providing a fallback empty object.
                        const rowData: Record<string, number> = powerMap.get(power) || {};
                        const total = locationColumns.reduce((sum, loc) => sum + (rowData[loc] || 0), 0);
                        return { power: `${power}W`, ...rowData, total: total };
                    });
                    const columnTotals: Record<string, number> = {};
                    let grandTotal = 0;
                    locationColumns.forEach(loc => {
                        // FIX: Use type assertion to prevent potential TypeScript errors with dynamic property access.
                        const total = powerData.reduce((sum, row) => sum + ((row as any)[loc] || 0), 0);
                        columnTotals[loc] = total; grandTotal += total;
                    });
                    return { powerData, locationColumns, columnTotals, grandTotal };
                })();

                if (powerData.length > 0) {
                    const titleHeight = 8;
                    const titleSpacing = 8;
                    const estimatedTableRowHeight = 4;
                    const estimatedTableHeaderFooterHeight = 5;
                    const estimatedTableHeight = (powerData.length * estimatedTableRowHeight) + (2 * estimatedTableHeaderFooterHeight);
                    const totalSpaceNeeded = titleHeight + titleSpacing + estimatedTableHeight;

                    const pageHeight = doc.internal.pageSize.getHeight();
                    const pageBottom = pageHeight - pageMargin;

                    if (yPos + totalSpaceNeeded > pageBottom) {
                        doc.addPage();
                        yPos = 20;
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
                await addChartToPdf('pdf-zone-chart', 'Porcentaje de Fallas por Zona');
                await addChartToPdf('pdf-municipio-chart', 'Porcentaje de Fallas por Municipio');
                
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

    const latestDataDate = useMemo(() => {
        const allDates: number[] = [];

        allEvents.forEach(e => {
            if (e.date) allDates.push(e.date.getTime());
        });

        changeEvents.forEach(e => {
            if (e.fechaRetiro) allDates.push(e.fechaRetiro.getTime());
        });

        inventory.forEach(i => {
            if (i.ultimoInforme) allDates.push(i.ultimoInforme.getTime());
        });

        if (allDates.length === 0) {
            return null;
        }

        return new Date(Math.max(...allDates));
    }, [allEvents, changeEvents, inventory]);


    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
            {isExportingPdf && (
                <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1100px', backgroundColor: '#111827', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Eventos */}
                    <div id="pdf-event-indicators" className="bg-gray-800 p-4 rounded-xl">
                        <div className="grid grid-cols-4 gap-4">
                            <DashboardCard title="Total Eventos" value={baseFilteredEvents.length.toLocaleString()} />
                            <DashboardCard title="Inaccesibles" value={inaccesibleFailures.toLocaleString()} />
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
                    <div id="pdf-zone-chart" className="bg-gray-800 p-4 rounded-xl"><FailureByZoneChart data={failureDataByZone.data} /></div>
                    <div id="pdf-municipio-chart" className="bg-gray-800 p-4 rounded-xl"><FailureByMunicipioChart data={failureDataByMunicipio.data} /></div>
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
                latestDataDate={latestDataDate}
                isDataManagementVisible={isDataManagementVisible}
                onToggleDataManagement={() => setIsDataManagementVisible(v => !v)}
                isFiltersVisible={isFiltersVisible}
                onToggleFilters={() => setIsFiltersVisible(v => !v)}
            />
            <main className="flex-grow container mx-auto px-4 md:px-8 pt-4 overflow-hidden flex flex-col">
                <div className="flex-shrink-0">
                    {isDataManagementVisible && (
                        <div id="data-management-panel" className="bg-gray-800 shadow-lg rounded-xl p-4 mb-4">
                             <div className="flex flex-col items-center">
                                <h2 className="text-xl font-bold text-cyan-400 mb-2">Gestión de Datos</h2>
                                <p className="text-gray-400 mb-4 text-center">
                                    Cargue planillas de datos, gestione respaldos y exporte resultados.
                                </p>
                                <div className="w-full max-w-4xl flex flex-col items-center gap-y-3">
                                    {/* --- Fila 1: Carga de Planillas --- */}
                                    <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <FileUpload onFileUpload={addEventsFromCSV} loading={loading} />
                                        
                                        <input type="file" id="change-csv-upload-input" accept=".csv" onChange={handleChangesFileChange} className="hidden" disabled={loading} />
                                        <button onClick={() => document.getElementById('change-csv-upload-input')?.click()} disabled={loading} className="w-full h-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M5.5 9.5L4 11m0 0l1.5 1.5M4 11h16m-5-5v5h5m-5-1.5l1.5 1.5m0 0L20 9.5" /></svg>
                                            <span>Cargar Cambios</span>
                                        </button>
                                        
                                        <input type="file" id="inventory-csv-upload-input" accept=".csv" onChange={handleInventoryFileChange} className="hidden" disabled={loading} />
                                        <button onClick={() => document.getElementById('inventory-csv-upload-input')?.click()} disabled={loading} className="w-full h-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2-2H4a2 2 0 01-2-2v-4z" /></svg>
                                            <span>Cargar Inventario</span>
                                        </button>
                                    </div>
                                    
                                    {/* --- Fila 2: Respaldos --- */}
                                     <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button onClick={downloadDataAsJSON} disabled={loading || noDataLoaded} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                            Descargar Respaldo JSON
                                        </button>
                                        <input type="file" id="json-upload-input" accept=".json" onChange={handleJsonFileChange} className="hidden" disabled={loading} />
                                        <button onClick={() => document.getElementById('json-upload-input')?.click()} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                            <span>Cargar Respaldo JSON</span>
                                        </button>
                                    </div>

                                    {/* --- Fila 3: Acciones Globales --- */}
                                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button onClick={handleExportPDF} disabled={loading || isExportingPdf || noDataLoaded} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                            {isExportingPdf ? 'Exportando...' : 'Exportar a PDF'}
                                        </button>
                                        <button onClick={resetApplication} disabled={loading || noDataLoaded} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                            Reiniciar Aplicación
                                        </button>
                                    </div>
                                </div>
                                {error && <p className="text-red-400 mt-4">{error}</p>}
                                {uploadedFileNames.length > 0 && (
                                    <div className="mt-6 border-t border-gray-700 pt-4 w-full max-w-6xl">
                                        <div className="flex justify-between items-center">
                                            <h3 className="text-lg font-semibold text-cyan-400">Planillas Cargadas ({uploadedFileNames.length})</h3>
                                            {uploadedFileNames.length > 1 && (
                                                <button onClick={() => setIsFilelistVisible(!isFilelistVisible)} className="p-1 rounded-full hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-expanded={isFilelistVisible} aria-controls="file-list">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-400 transform transition-transform duration-300 ${ isFilelistVisible ? 'rotate-180' : '' }`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                            )}
                                        </div>
                                        {isFilelistVisible && (
                                            <ul id="file-list" className="list-inside text-gray-400 max-h-32 overflow-y-auto text-sm space-y-2 bg-gray-900/50 p-3 rounded-md mt-2">
                                                {uploadedFileNames.map(name => (
                                                    <li key={name} className="flex justify-between items-center bg-gray-700/50 p-2 rounded">
                                                        <span>{name}</span>
                                                        <button onClick={() => handleDeleteData(name)} className="text-red-500 hover:text-red-400 p-1 rounded-full hover:bg-gray-600 transition-colors" title={`Eliminar datos de ${name}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </li>
                                                ))}
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
                                    activeTab={activeTab} dateRange={dateRange} setDateRange={setDateRange} handleSetDatePreset={handleSetDatePreset}
                                    selectedZone={selectedZone} setSelectedZone={setSelectedZone} selectedMunicipio={selectedMunicipio}
                                    setSelectedMunicipio={setSelectedMunicipio} municipios={filteredMunicipios} selectedCategory={selectedCategory}
                                    setSelectedCategory={setSelectedCategory} zones={zones.length > 0 ? zones : ALL_ZONES} failureCategories={failureCategories}
                                    availableYears={availableYears} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
                                    selectedYear={selectedYear} setSelectedYear={setSelectedYear} availablePowers={availablePowers}
                                    selectedPower={selectedPower} setSelectedPower={setSelectedPower} availableCalendars={availableCalendars}
                                    selectedCalendar={selectedCalendar} setSelectedCalendar={setSelectedCalendar} setSearchTerm={setSearchTerm}
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
                        <div className="space-y-6">
                            {activeTab === 'eventos' && allEvents.length > 0 && (
                                <>
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
                                    <CollapsibleSection title="Detalle de Eventos por Zona" onExport={handleExportFailureByZone} defaultOpen={true}><FailurePercentageTable data={failureDataByZone.data} categories={failureDataByZone.categories} locationHeader="Zona" /></CollapsibleSection>
                                    <div id="municipio-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Porcentaje de Fallas por Municipio (% del Inventario)</h3><FailureByMunicipioChart data={failureDataByMunicipio.data} /></div>
                                    <CollapsibleSection title="Detalle de Fallas por Municipio" onExport={handleExportFailureByMunicipio}><FailurePercentageTable data={failureDataByMunicipio.data} categories={failureDataByMunicipio.categories} locationHeader="Municipio" /></CollapsibleSection>
                                    <div id="events-by-month-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Volumen de Eventos por Mes (Últimos 12 Meses)</h3><EventsByMonthChart data={baseFilteredEvents} /></div>
                                    <CollapsibleSection title="Registro de Eventos de Falla" onExport={cardFilter ? handleExportFilteredEvents : undefined}><EventTable events={displayEvents} /></CollapsibleSection>
                                    <CollapsibleSection title="Eventos Reportados Más Antiguos por Zona"><OldestEventsByZone data={oldestEventsByZone} /></CollapsibleSection>
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
                                    <div className="grid grid-cols-1 gap-4"><div id="changes-by-zone-chart-container" className="bg-gray-800 shadow-lg rounded-xl p-4"><h3 className="text-lg font-semibold text-cyan-400 mb-3">Cambios por Zona</h3><ChangesByZoneChart data={baseFilteredChangeEvents} /></div></div>
                                    <CollapsibleSection title="Resumen de Cambios por Municipio" onExport={handleExportChangesByMunicipio}><ChangesByMunicipioTable data={changesByMunicipioData} /></CollapsibleSection>
                                    <CollapsibleSection title="Registro de Cambios" defaultOpen={true} extraHeaderContent={<div className="relative flex items-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" placeholder="Buscar en Cambios..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()} className="w-64 bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-10 text-white" />{searchTerm && (<button onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }} className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>)}</div>}><ChangeEventTable events={displayChangeEvents} /></CollapsibleSection>
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
                                </>
                            )}

                        </div>
                    )}

                    {noDataLoaded && (
                        <div className="text-center p-16 bg-gray-800 rounded-lg">
                            <h2 className="text-2xl font-semibold text-gray-300">No hay datos cargados</h2>
                            <p className="text-gray-500 mt-2">Utilice los botones de "Gestión de Datos" para cargar planillas y comenzar el análisis.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default App;