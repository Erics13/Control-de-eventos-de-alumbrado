





import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import type { LuminaireEvent, InventoryItem, ActiveTab, ChangeEvent, BroadcastMessage } from './types';
import { ALL_ZONES, MUNICIPIO_TO_ZONE_MAP, ZONE_ORDER } from './constants';

import Header from './components/Header';
import FileUpload from './components/FileUpload';
import FilterControls from './components/FilterControls';
import CollapsibleSection from './components/CollapsibleSection';
import TabButton from './components/TabButton';
import EventosTab from './components/EventosTab';
import CambiosTab from './components/CambiosTab';
import InventarioTab from './components/InventarioTab';

const ERROR_DESC_LOW_CURRENT = "La corriente medida es menor que lo esperado o no hay corriente que fluya a través de la combinación de driver y lámpara.";
const ERROR_DESC_HIGH_CURRENT = "La corriente medida para la combinación de driver y lámpara es mayor que la esperada.";
const ERROR_DESC_VOLTAGE = "El voltaje de la red eléctrica de entrada detectado del sistema es muy bajo o muy alto. Esto podría llevar a fallas del sistema.";

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

// Full application state that will be synced across windows
interface FullAppState {
    // Filters
    dateRange: { start: Date | null; end: Date | null };
    selectedZone: string;
    selectedMunicipio: string;

    selectedCategory: string;
    selectedMonth: string;
    selectedYear: string;
    selectedPower: string;
    selectedCalendar: string;
    searchTerm: string;
    // Card Filters
    cardFilter: string | null;
    cardChangeFilter: string | null;
    cardInventoryFilter: { key: keyof InventoryItem; value: string } | null;
    // UI State
    isInventorySummariesOpen: boolean;
    selectedOperatingHoursRange: string | null;
    latestDataDate: Date | null;
}

const App: React.FC = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const portalTab = urlParams.get('portal') as ActiveTab | null;

    const { 
        allEvents, changeEvents, inventory, 
        uploadedFileNames, 
        addEventsFromCSV, addChangeEventsFromCSV, addInventoryFromCSV, 
        addEventsFromJSON, downloadDataAsJSON, 
        deleteDataByFileName, resetApplication, 
        loading, error 
    } = useLuminaireData();
    
    // All state is managed here in the main component
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

    // New state for windowing
    const [poppedOutTabs, setPoppedOutTabs] = useState<ActiveTab[]>([]);
    const [portalState, setPortalState] = useState<FullAppState | null>(null);
    const isMainApp = useRef(!portalTab);

    const latestDataDate = useMemo(() => {
        const allDates: number[] = [];
        allEvents.forEach(e => { if (e.date) allDates.push(e.date.getTime()); });
        changeEvents.forEach(e => { if (e.fechaRetiro) allDates.push(e.fechaRetiro.getTime()); });
        inventory.forEach(i => { if (i.ultimoInforme) allDates.push(i.ultimoInforme.getTime()); });
        if (allDates.length === 0) return null;
        return new Date(Math.max(...allDates));
    }, [allEvents, changeEvents, inventory]);

    // ---- Broadcast Channel Logic ----
    const handleBroadcastMessage = useCallback((message: BroadcastMessage) => {
        // FIX: Explicitly cast payload to its expected type to resolve type errors on destructuring.
        const { type, payload } = message as { type: string, payload: any };

        if (isMainApp.current) { // Main app listens for docking messages
            if (type === 'DOCK_TAB') {
                setPoppedOutTabs(prev => prev.filter(t => t !== payload));
            }
             if (type === 'REQUEST_INITIAL_STATE') {
                // A portal has opened and is requesting the current state
                const currentState: FullAppState = {
                    dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
                    selectedPower, selectedCalendar, searchTerm, cardFilter, cardChangeFilter, cardInventoryFilter,
                    isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate
                };
                 postMessage({ type: 'INITIAL_STATE_RESPONSE', payload: currentState });
            }
        } else { // Portal app listens for state updates
            if (type === 'STATE_UPDATE' || type === 'INITIAL_STATE_RESPONSE') {
                const receivedState = payload as FullAppState;
                // Dates need to be reconstructed
                const newDateRange = {
                    start: receivedState.dateRange.start ? new Date(receivedState.dateRange.start) : null,
                    end: receivedState.dateRange.end ? new Date(receivedState.dateRange.end) : null
                };
                const newLatestDate = receivedState.latestDataDate ? new Date(receivedState.latestDataDate) : null;
                setPortalState({ ...receivedState, dateRange: newDateRange, latestDataDate: newLatestDate });
            }
        }
    }, [isMainApp.current, dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear, selectedPower, selectedCalendar, searchTerm, cardFilter, cardChangeFilter, cardInventoryFilter, isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate]);

    const { postMessage } = useBroadcastChannel(handleBroadcastMessage);

    // Effect for main app to broadcast state changes
    useEffect(() => {
        if (isMainApp.current) {
            const fullState: FullAppState = {
                dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
                selectedPower, selectedCalendar, searchTerm, cardFilter, cardChangeFilter, cardInventoryFilter,
                isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate
            };
            postMessage({ type: 'STATE_UPDATE', payload: fullState });
        }
    }, [
        dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
        selectedPower, selectedCalendar, searchTerm, cardFilter, cardChangeFilter, cardInventoryFilter,
        isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate, postMessage
    ]);
    
     // Effect for portal app to request initial state on load
    useEffect(() => {
        if (portalTab) {
            postMessage({ type: 'REQUEST_INITIAL_STATE', payload: null });
        }
    }, [portalTab, postMessage]);
    
    // Effect for portal to message main app on close
    useEffect(() => {
        if (portalTab) {
            const handleBeforeUnload = () => {
                postMessage({ type: 'DOCK_TAB', payload: portalTab });
            };
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => {
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [portalTab, postMessage]);

    // Handlers
    const handleCardClick = useCallback((filterType: string) => { setCardFilter(prev => (prev === filterType ? null : filterType)); setCardChangeFilter(null); setCardInventoryFilter(null); }, []);
    const handleCardChangeClick = useCallback((filterType: string) => { setCardChangeFilter(prev => (prev === filterType ? null : filterType)); setCardFilter(null); setCardInventoryFilter(null); }, []);
    const handleCardInventoryClick = useCallback((key: keyof InventoryItem, value: string) => { setCardInventoryFilter(prev => (prev && prev.key === key && prev.value === value) ? null : { key, value }); setCardFilter(null); setCardChangeFilter(null); }, []);
    const handleSetDatePreset = useCallback((preset: 'today' | 'yesterday' | 'week' | 'month' | 'year') => { setSelectedMonth(''); setSelectedYear(''); const now = new Date(); let start, end; switch (preset) { case 'today': start = startOfDay(now); end = endOfDay(now); break; case 'yesterday': const yesterday = subDays(now, 1); start = startOfDay(yesterday); end = endOfDay(yesterday); break; case 'week': end = now; start = subDays(now, 7); break; case 'month': end = now; start = startOfMonth(now); break; case 'year': end = now; start = startOfYear(now); break; } setDateRange({ start, end }); }, []);
    
    useEffect(() => { if (selectedMonth && selectedYear) { const yearNum = parseInt(selectedYear); const monthNum = parseInt(selectedMonth) - 1; const start = new Date(yearNum, monthNum, 1); const end = endOfMonth(start); setDateRange({ start, end }); } else if (selectedYear && !selectedMonth) { const yearNum = parseInt(selectedYear); const start = startOfYear(new Date(yearNum, 0, 1)); const end = endOfYear(new Date(yearNum, 11, 31)); setDateRange({ start, end }); } else if (!selectedYear && selectedMonth) { setDateRange({ start: null, end: null }); } }, [selectedMonth, selectedYear]);
    useEffect(() => { if (loading) return; const hasInventory = inventory.length > 0; const hasChanges = changeEvents.length > 0; const hasEvents = allEvents.length > 0; const tabs: { id: ActiveTab; hasData: boolean }[] = [ { id: 'inventario', hasData: hasInventory }, { id: 'cambios', hasData: hasChanges }, { id: 'eventos', hasData: hasEvents }, ]; const currentTab = tabs.find(t => t.id === activeTab); if (currentTab && !currentTab.hasData) { const firstAvailableTab = tabs.find(t => t.hasData); if (firstAvailableTab) { setActiveTab(firstAvailableTab.id as ActiveTab); } } else if (!hasInventory && !hasChanges && !hasEvents) { setActiveTab('inventario'); } }, [inventory.length, changeEvents.length, allEvents.length, activeTab, loading]);

    const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) { addEventsFromJSON(file); event.target.value = ''; } };
    const handleChangesFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if(file) { addChangeEventsFromCSV(file); event.target.value = ''; } };
    const handleInventoryFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if(file) { addInventoryFromCSV(file); event.target.value = ''; } };
    const handleDeleteData = async (fileName: string) => { if (window.confirm(`¿Estás seguro de que quieres borrar todos los datos del archivo "${fileName}"? Esta acción no se puede deshacer.`)) { await deleteDataByFileName(fileName); } };
    const handleOperatingHoursRowClick = useCallback((range: string) => { setSelectedOperatingHoursRange(prev => (prev === range ? null : range)); }, []);
    
    const handlePopOut = (tabId: ActiveTab) => {
        window.open(`/?portal=${tabId}`, `portal_${tabId}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
        setPoppedOutTabs(prev => [...prev, tabId]);
    };

    // Use portal state if available, otherwise use main app state
    const currentAppState = portalState || {
        dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
        selectedPower, selectedCalendar, searchTerm, cardFilter, cardChangeFilter, cardInventoryFilter,
        isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate
    };
    
    // --- All data calculations are performed once, based on the current state ---
    const baseFilteredEvents = useMemo(() => { return allEvents.filter(event => { const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date; let isDateInRange = true; if (currentAppState.dateRange.start && currentAppState.dateRange.end) { isDateInRange = isWithinInterval(eventDate, { start: currentAppState.dateRange.start, end: currentAppState.dateRange.end }); } else if (currentAppState.selectedMonth && !currentAppState.selectedYear) { isDateInRange = (eventDate.getMonth() + 1) === parseInt(currentAppState.selectedMonth, 10); } const isZoneMatch = currentAppState.selectedZone === 'all' || event.zone === currentAppState.selectedZone; const isMunicipioMatch = currentAppState.selectedMunicipio === 'all' || event.municipio === currentAppState.selectedMunicipio; const isCategoryMatch = currentAppState.selectedCategory === 'all' || event.failureCategory === currentAppState.selectedCategory; return isDateInRange && isZoneMatch && isMunicipioMatch && isCategoryMatch; }); }, [allEvents, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, currentAppState.selectedCategory, currentAppState.selectedMonth, currentAppState.selectedYear]);
    const baseFilteredChangeEvents = useMemo(() => { return changeEvents.filter(event => { const eventDate = event.fechaRetiro; let isDateInRange = true; if (currentAppState.dateRange.start && currentAppState.dateRange.end) { isDateInRange = isWithinInterval(eventDate, { start: currentAppState.dateRange.start, end: currentAppState.dateRange.end }); } else if (currentAppState.selectedMonth && !currentAppState.selectedYear) { isDateInRange = (eventDate.getMonth() + 1) === parseInt(currentAppState.selectedMonth, 10); } const isZoneMatch = currentAppState.selectedZone === 'all' || event.zone === currentAppState.selectedZone; const isMunicipioMatch = currentAppState.selectedMunicipio === 'all' || event.municipio === currentAppState.selectedMunicipio; const searchLower = currentAppState.searchTerm.toLowerCase().trim(); if (searchLower === '') { return isDateInRange && isZoneMatch && isMunicipioMatch; } const normalizedSearchTerm = searchLower.replace(/:/g, '').replace(/\s/g, ''); const isSearchMatch = (event.poleIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) || (event.streetlightIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) || (event.componente || '').toLowerCase().includes(searchLower) || (event.designacionTipo || '').toLowerCase().includes(searchLower) || (event.cabinetIdExterno || '').toLowerCase().includes(searchLower); return isDateInRange && isZoneMatch && isMunicipioMatch && isSearchMatch; }); }, [changeEvents, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, currentAppState.searchTerm, currentAppState.selectedMonth, currentAppState.selectedYear]);
    const displayInventory = useMemo(() => { return inventory.filter(item => { const relevantDate = item.fechaInauguracion && item.fechaInstalacion ? (item.fechaInauguracion > item.fechaInstalacion ? item.fechaInauguracion : item.fechaInstalacion) : item.fechaInauguracion || item.fechaInstalacion; const isDateInRange = !relevantDate || !currentAppState.dateRange.start || !currentAppState.dateRange.end || isWithinInterval(relevantDate, { start: currentAppState.dateRange.start, end: currentAppState.dateRange.end }); const isZoneMatch = currentAppState.selectedZone === 'all' || item.zone === currentAppState.selectedZone; const isMunicipioMatch = currentAppState.selectedMunicipio === 'all' || item.municipio === currentAppState.selectedMunicipio; const isPowerMatch = currentAppState.selectedPower === 'all' || String(item.potenciaNominal) === currentAppState.selectedPower; const isCalendarMatch = currentAppState.selectedCalendar === 'all' || item.dimmingCalendar === currentAppState.selectedCalendar; return isDateInRange && isZoneMatch && isMunicipioMatch && isPowerMatch && isCalendarMatch; }); }, [inventory, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, currentAppState.selectedPower, currentAppState.selectedCalendar]);
    const finalDisplayInventory = useMemo(() => { if (!currentAppState.cardInventoryFilter) { return displayInventory; } return displayInventory.filter(item => { const itemValue = item[currentAppState.cardInventoryFilter.key]; if (typeof itemValue !== 'string') { return false; } const filterValue = currentAppState.cardInventoryFilter.value.toUpperCase().trim(); const processedItemValue = itemValue.toUpperCase().trim(); if (currentAppState.cardInventoryFilter.key === 'situacion' && filterValue === 'VANDALIZADO') { return processedItemValue.startsWith('VANDALIZADO'); } return processedItemValue === filterValue; }); }, [displayInventory, currentAppState.cardInventoryFilter]);
    const displayEvents = useMemo(() => { if (!currentAppState.cardFilter) { return baseFilteredEvents; } switch (currentAppState.cardFilter) { case 'lowCurrent': return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_LOW_CURRENT); case 'highCurrent': return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_HIGH_CURRENT); case 'voltage': return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_VOLTAGE); case 'columnaCaida': return baseFilteredEvents.filter(e => e.failureCategory === 'Columna Caída'); case 'hurto': return baseFilteredEvents.filter(e => e.failureCategory === 'Hurto'); case 'vandalizado': return baseFilteredEvents.filter(e => e.failureCategory === 'Vandalizado'); case 'inaccesible': return baseFilteredEvents.filter(e => e.failureCategory === 'Inaccesible'); default: return baseFilteredEvents; } }, [baseFilteredEvents, currentAppState.cardFilter]);
    const displayChangeEvents = useMemo(() => { if (!currentAppState.cardChangeFilter) { return baseFilteredChangeEvents; } switch (currentAppState.cardChangeFilter) { case 'luminaria': return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('LUMINARIA')); case 'olc': return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('OLC')); case 'garantia': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'garantia'); case 'vandalizado': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'vandalizado'); case 'columnaCaidaChange': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'columna caída'); case 'hurtoChange': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'hurto'); default: return baseFilteredChangeEvents; } }, [baseFilteredChangeEvents, currentAppState.cardChangeFilter]);
    
    // --- Memoized derived data for charts and tables ---
    const failureCategories = useMemo(() => { const categories = new Set(allEvents.map(e => e.failureCategory).filter((c): c is string => !!c)); return Array.from(categories).sort(); }, [allEvents]);
    const zones = useMemo(() => { const zoneSet = new Set([...allEvents.map(e => e.zone), ...changeEvents.map(e => e.zone), ...inventory.map(i => i.zone)]); return Array.from(zoneSet).sort(); }, [allEvents, changeEvents, inventory]);
    const municipios = useMemo(() => { const municipioSet = new Set([...allEvents.map(e => e.municipio), ...changeEvents.map(e => e.municipio), ...inventory.map(i => i.municipio)]); return Array.from(municipioSet).sort(); }, [allEvents, changeEvents, inventory]);
    const filteredMunicipios = useMemo(() => { if (currentAppState.selectedZone === 'all') { return municipios; } return municipios.filter(m => MUNICIPIO_TO_ZONE_MAP[m.toUpperCase()] === currentAppState.selectedZone); }, [currentAppState.selectedZone, municipios]);
    useEffect(() => { if (isMainApp.current && selectedMunicipio !== 'all' && !filteredMunicipios.includes(selectedMunicipio)) { setSelectedMunicipio('all'); } }, [selectedZone, filteredMunicipios, selectedMunicipio]);
    const availableYears = useMemo(() => { if (allEvents.length === 0 && changeEvents.length === 0) return []; const years = new Set<string>(); allEvents.forEach(event => { years.add(format(event.date, 'yyyy')); }); changeEvents.forEach(event => { years.add(format(event.fechaRetiro, 'yyyy')); }); return Array.from(years).sort((a: string, b: string) => parseInt(b) - parseInt(a)); }, [allEvents, changeEvents]);
    const availablePowers = useMemo(() => { const powers = new Set(inventory.map(i => i.potenciaNominal).filter((p): p is number => p != null)); return Array.from(powers).sort((a: number, b: number) => a - b).map(String); }, [inventory]);
    const availableCalendars = useMemo(() => { const calendars = new Set(inventory.map(i => i.dimmingCalendar).filter((c): c is string => !!c && c !== '-')); return Array.from(calendars).sort(); }, [inventory]);
    
    // --- Metrics Calculations ---
    const uniqueCabinetCount = useMemo(() => new Set(displayInventory.map(i => i.cabinetIdExterno).filter((c): c is string => !!c && c.trim() !== '' && c.trim() !== '-')).size, [displayInventory]);
    const inauguratedCount = useMemo(() => displayInventory.filter(item => item.fechaInauguracion).length, [displayInventory]);
    const markedCount = useMemo(() => inventory.filter(item => item.marked?.trim().toUpperCase() === 'YES').length, [inventory]);
    const uniqueAccountCount = useMemo(() => new Set(displayInventory.map(i => i.nroCuenta).filter((c): c is string => !!c && c.trim() !== '' && c.trim() !== '-')).size, [displayInventory]);
    const vandalizadoInventoryCount = useMemo(() => displayInventory.filter(item => item.situacion?.toUpperCase().trim().startsWith('VANDALIZADO')).length, [displayInventory]);
    const hurtoInventoryCount = useMemo(() => displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'HURTO').length, [displayInventory]);
    const columnaCaidaInventoryCount = useMemo(() => displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'COLUMNA CAIDA').length, [displayInventory]);
    const faltaPodaInventoryCount = useMemo(() => displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'FALTA PODA').length, [displayInventory]);
    const faltaLineaInventoryCount = useMemo(() => displayInventory.filter(item => item.situacion?.toUpperCase().trim() === 'FALTA LINEA').length, [displayInventory]);
    const lowCurrentFailures = useMemo(() => baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_LOW_CURRENT).length, [baseFilteredEvents]);
    const highCurrentFailures = useMemo(() => baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_HIGH_CURRENT).length, [baseFilteredEvents]);
    const voltageFailures = useMemo(() => baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_VOLTAGE).length, [baseFilteredEvents]);
    const columnaCaidaFailures = useMemo(() => baseFilteredEvents.filter(e => e.failureCategory === 'Columna Caída').length, [baseFilteredEvents]);
    const hurtoFailures = useMemo(() => baseFilteredEvents.filter(e => e.failureCategory === 'Hurto').length, [baseFilteredEvents]);
    const vandalizadoFailures = useMemo(() => baseFilteredEvents.filter(e => e.failureCategory === 'Vandalizado').length, [baseFilteredEvents]);
    const inaccesibleFailures = useMemo(() => baseFilteredEvents.filter(e => e.failureCategory === 'Inaccesible').length, [baseFilteredEvents]);
    const luminariaChangesCount = useMemo(() => baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('LUMINARIA')).length, [baseFilteredChangeEvents]);
    const olcChangesCount = useMemo(() => baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('OLC')).length, [baseFilteredChangeEvents]);
    const garantiaChangesCount = useMemo(() => baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'garantia').length, [baseFilteredChangeEvents]);
    const vandalizadoChangesCount = useMemo(() => baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'vandalizado').length, [baseFilteredChangeEvents]);
    const columnaCaidaChangesCount = useMemo(() => baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'columna caída').length, [baseFilteredChangeEvents]);
    const hurtoChangesCount = useMemo(() => baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'hurto').length, [baseFilteredChangeEvents]);
    const oldestEventsByZone = useMemo(() => { if (allEvents.length === 0) return []; const map = new Map<string, LuminaireEvent>(); for (let i = allEvents.length - 1; i >= 0; i--) { const event = allEvents[i]; if (!map.has(event.zone)) { map.set(event.zone, event); } } return Array.from(map.values()).sort((a, b) => a.zone.localeCompare(b.zone)); }, [allEvents]);
    const inventoryCountByZone = useMemo(() => inventory.reduce((acc, item) => { if (item.zone) { acc[item.zone] = (acc[item.zone] || 0) + 1; } return acc; }, {} as Record<string, number>), [inventory]);
    const inventoryCountByMunicipio = useMemo(() => inventory.reduce((acc, item) => { if (item.municipio) { acc[item.municipio] = (acc[item.municipio] || 0) + 1; } return acc; }, {} as Record<string, number>), [inventory]);
    // FIX: Add explicit string types to sort callback parameters to fix type inference issues.
    const filteredFailureCategories = useMemo(() => { const order = ['Inaccesible', 'Roto', 'Error de configuración', 'Falla de hardware', 'Falla de voltaje', 'Hurto', 'Vandalizado', 'Columna Caída']; const allCats = Array.from(new Set(baseFilteredEvents.map(e => e.failureCategory).filter((c): c is string => !!c))); return allCats.sort((a: string, b: string) => { const iA = order.indexOf(a); const iB = order.indexOf(b); if (iA !== -1 && iB !== -1) return iA - iB; if (iA !== -1) return -1; if (iB !== -1) return 1; return a.localeCompare(b); }); }, [baseFilteredEvents]);
    const failureDataByZone = useMemo(() => {
        if (Object.keys(inventoryCountByZone).length === 0) return { data: [], categories: [] };
        const counts = baseFilteredEvents.reduce((acc, event) => {
            if (!acc[event.zone]) acc[event.zone] = { total: 0, categories: {} };
            acc[event.zone].total++;
            if (event.failureCategory) acc[event.zone].categories[event.failureCategory] = (acc[event.zone].categories[event.failureCategory] || 0) + 1;
            return acc;
        }, {} as Record<string, { total: number; categories: Record<string, number> }>);
        const data = Object.keys(inventoryCountByZone).map(zone => {
            const eventData = counts[zone] || { total: 0, categories: {} };
            const totalInventario = inventoryCountByZone[zone];
            // FIX: Replaced Object.fromEntries with a reduce call to ensure catCounts is a spreadable object type, which resolves the spread operator error.
            const catCounts = filteredFailureCategories.reduce((acc, cat) => {
                acc[cat] = eventData.categories[cat] || 0;
                return acc;
            }, {} as Record<string, number>);
            return { name: zone, eventos: eventData.total, totalInventario, porcentaje: totalInventario > 0 ? (eventData.total / totalInventario) * 100 : 0, ...catCounts };
        });
        const sorted = data.sort((a, b) => {
            const iA = ZONE_ORDER.indexOf(a.name);
            const iB = ZONE_ORDER.indexOf(b.name);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1;
            if (iB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
        return { data: sorted, categories: filteredFailureCategories };
    }, [baseFilteredEvents, inventoryCountByZone, filteredFailureCategories]);
    const failureDataByMunicipio = useMemo(() => {
        if (Object.keys(inventoryCountByMunicipio).length === 0) return { data: [], categories: [] };
        const counts = baseFilteredEvents.reduce((acc, event) => {
            if (!acc[event.municipio]) acc[event.municipio] = { total: 0, categories: {} };
            acc[event.municipio].total++;
            if (event.failureCategory) acc[event.municipio].categories[event.failureCategory] = (acc[event.municipio].categories[event.failureCategory] || 0) + 1;
            return acc;
        }, {} as Record<string, { total: number; categories: Record<string, number> }>);
        const data = Object.keys(inventoryCountByMunicipio).map(muni => {
            const eventData = counts[muni] || { total: 0, categories: {} };
            const totalInventario = inventoryCountByMunicipio[muni];
            // FIX: Replaced Object.fromEntries with a reduce call to ensure catCounts is a spreadable object type, which resolves the spread operator error.
            const catCounts = filteredFailureCategories.reduce((acc, cat) => {
                acc[cat] = eventData.categories[cat] || 0;
                return acc;
            }, {} as Record<string, number>);
            return { name: muni, eventos: eventData.total, totalInventario, porcentaje: totalInventario > 0 ? (eventData.total / totalInventario) * 100 : 0, ...catCounts };
        }).sort((a,b) => b.porcentaje - a.porcentaje);
        return { data, categories: filteredFailureCategories };
    }, [baseFilteredEvents, inventoryCountByMunicipio, filteredFailureCategories]);
    const changesByMunicipioData = useMemo(() => { const counts = baseFilteredChangeEvents.reduce((acc, event) => { if (!event.municipio) return acc; if (!acc[event.municipio]) acc[event.municipio] = { LUMINARIA: 0, OLC: 0, total: 0 }; const component = event.componente.toUpperCase(); if (component.includes('LUMINARIA')) { acc[event.municipio].LUMINARIA++; acc[event.municipio].total++; } else if (component.includes('OLC')) { acc[event.municipio].OLC++; acc[event.municipio].total++; } return acc; }, {} as Record<string, { LUMINARIA: number; OLC: number; total: number }>); return Object.entries(counts).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total); }, [baseFilteredChangeEvents]);
    const cabinetSummaryData = useMemo(() => { const counts = inventory.reduce((acc, item) => { if (item.cabinetIdExterno) acc[item.cabinetIdExterno] = (acc[item.cabinetIdExterno] || 0) + 1; return acc; }, {} as Record<string, number>); return Object.entries(counts).map(([cabinetId, luminaireCount]) => ({ cabinetId, luminaireCount })).filter(item => item.cabinetId && item.cabinetId !== '-' && item.cabinetId.trim() !== ''); }, [inventory]);
    const serviceSummaryData = useMemo(() => { const map = inventory.reduce((acc, item) => { if (item.nroCuenta && item.nroCuenta.trim() !== '' && item.nroCuenta.trim() !== '-') { const cuenta = item.nroCuenta.trim(); if (!acc.has(cuenta)) acc.set(cuenta, { luminaireCount: 0, totalPower: 0 }); const summary = acc.get(cuenta)!; summary.luminaireCount += 1; summary.totalPower += item.potenciaNominal || 0; } return acc; }, new Map<string, { luminaireCount: number; totalPower: number }>()); return Array.from(map.entries()).map(([nroCuenta, data]) => ({ nroCuenta, luminaireCount: data.luminaireCount, totalPower: data.totalPower })); }, [inventory]);
    const powerSummary = useMemo(() => { const items = finalDisplayInventory; if (items.length === 0) return { powerData: [], locationColumns: [], columnTotals: {}, grandTotal: 0 }; const isGroupingByZone = currentAppState.selectedZone === 'all'; const locationColumns: string[] = isGroupingByZone ? ALL_ZONES.filter(zone => items.some(item => item.zone === zone)) : Array.from(new Set<string>(items.map(item => item.municipio).filter((m): m is string => !!m))).sort(); const powers: number[] = Array.from(new Set<number>(items.map(item => item.potenciaNominal).filter((p): p is number => p != null))).sort((a, b) => a - b); const powerMap = new Map<number, Record<string, number>>(); for (const item of items) { if (item.potenciaNominal != null) { if (!powerMap.has(item.potenciaNominal)) powerMap.set(item.potenciaNominal, {}); const powerRow = powerMap.get(item.potenciaNominal)!; const location = isGroupingByZone ? item.zone : item.municipio; if (location) powerRow[location] = (powerRow[location] || 0) + 1; } } const powerData = powers.map(power => { const rowData: Record<string, number> = powerMap.get(power) || {}; const total = locationColumns.reduce((sum, loc) => sum + (rowData[loc] || 0), 0); return { power: `${power}W`, ...rowData, total: total }; }); const columnTotals: Record<string, number> = {}; let grandTotal = 0; locationColumns.forEach(loc => { const total = powerData.reduce((sum, row) => sum + ((row as any)[loc] || 0), 0); columnTotals[loc] = total; grandTotal += total; }); return { powerData, locationColumns, columnTotals, grandTotal }; }, [finalDisplayInventory, currentAppState.selectedZone]);
    const { operatingHoursSummary, operatingHoursZones } = useMemo(() => { const items = inventory; if (items.length === 0) return { operatingHoursSummary: [], operatingHoursZones: [] }; const RANGE_STEP = 5000, MAX_HOURS = 100000; const presentZones = new Set<string>(); const countsByRange = items.reduce((acc, item) => { if (item.horasFuncionamiento != null && item.horasFuncionamiento >= 0 && item.zone) { let rangeLabel; if (item.horasFuncionamiento > MAX_HOURS) rangeLabel = `> ${MAX_HOURS.toLocaleString('es-ES')} hs`; else if (item.horasFuncionamiento <= RANGE_STEP) rangeLabel = `0 - ${RANGE_STEP.toLocaleString('es-ES')} hs`; else { const rangeIndex = Math.floor((item.horasFuncionamiento - 1) / RANGE_STEP); const rangeStart = rangeIndex * RANGE_STEP + 1; const rangeEnd = (rangeIndex + 1) * RANGE_STEP; rangeLabel = `${rangeStart.toLocaleString('es-ES')} - ${rangeEnd.toLocaleString('es-ES')} hs`; } if (!acc[rangeLabel]) acc[rangeLabel] = { total: 0 }; acc[rangeLabel].total = (acc[rangeLabel].total || 0) + 1; acc[rangeLabel][item.zone] = (acc[rangeLabel][item.zone] || 0) + 1; presentZones.add(item.zone); } return acc; }, {} as Record<string, { total: number; [zone: string]: number }>); const sortedZones = Array.from(presentZones).sort((a, b) => { const iA = ZONE_ORDER.indexOf(a); const iB = ZONE_ORDER.indexOf(b); if (iA !== -1 && iB !== -1) return iA - iB; if (iA !== -1) return -1; if (iB !== -1) return 1; return a.localeCompare(b); }); const summary = Object.entries(countsByRange).map(([range, counts]) => ({ range, ...counts })); return { operatingHoursSummary: summary, operatingHoursZones: sortedZones }; }, [inventory]);
    const operatingHoursDetailData = useMemo((): InventoryItem[] => { if (!currentAppState.selectedOperatingHoursRange) return []; const parseRange = (rangeStr: string): { start: number; end: number } => { if (rangeStr.startsWith('>')) { const start = parseInt(rangeStr.replace(/\D/g, ''), 10); return { start, end: Infinity }; } const parts = rangeStr.replace(/ hs/g, '').replace(/\./g, '').split(' - '); return { start: parseInt(parts[0], 10), end: parseInt(parts[1], 10) }; }; const { start, end } = parseRange(currentAppState.selectedOperatingHoursRange); return inventory.filter(item => { if (item.horasFuncionamiento == null) return false; if (end === Infinity) return item.horasFuncionamiento > start; return item.horasFuncionamiento >= start && item.horasFuncionamiento <= end; }); }, [inventory, currentAppState.selectedOperatingHoursRange]);
    
    // --- Export Handlers ---
    const generateExportFilename = useCallback((baseName: string): string => { const dateStr = new Date().toISOString().split('T')[0]; const zoneStr = currentAppState.selectedZone !== 'all' ? `_${currentAppState.selectedZone.replace(/\s+/g, '_')}` : ''; const municipioStr = currentAppState.selectedMunicipio !== 'all' ? `_${currentAppState.selectedMunicipio.replace(/\s+/g, '_')}` : ''; return `${baseName}${zoneStr}${municipioStr}_${dateStr}.xlsx`; }, [currentAppState.selectedZone, currentAppState.selectedMunicipio]);
    const handleExportCabinetSummary = useCallback(() => { import('./utils/export').then(module => module.exportToXlsx(cabinetSummaryData, generateExportFilename('resumen_gabinetes'))); }, [cabinetSummaryData, generateExportFilename]);
    const handleExportServiceSummary = useCallback(() => { import('./utils/export').then(module => module.exportToXlsx(serviceSummaryData, generateExportFilename('resumen_servicios'))); }, [serviceSummaryData, generateExportFilename]);
    const handleExportPowerSummary = useCallback(() => { const { powerData, locationColumns, columnTotals, grandTotal } = powerSummary; if (powerData.length === 0) return; const exportData = powerData.map(row => { const flatRow: Record<string, any> = { Potencia: row.power }; locationColumns.forEach(loc => { flatRow[loc] = (row as any)[loc] || 0; }); flatRow['Total'] = row.total; return flatRow; }); const totalsRow: Record<string, any> = { Potencia: 'Total General' }; locationColumns.forEach(loc => { totalsRow[loc] = columnTotals[loc] || 0; }); totalsRow['Total'] = grandTotal; exportData.push(totalsRow); import('./utils/export').then(module => module.exportToXlsx(exportData, generateExportFilename('resumen_potencias'))); }, [powerSummary, generateExportFilename]);
    const handleExportFailureByZone = useCallback(() => { const { data: dataToExport, categories } = failureDataByZone; if (dataToExport.length === 0) return; const dataForSheet = dataToExport.map(item => { const row: Record<string, any> = { 'Zona': item.name, 'Porcentaje Fallas (%)': item.porcentaje.toFixed(2), 'Total Fallas': item.eventos, 'Total Inventario': item.totalInventario }; categories.forEach(cat => { row[cat] = item[cat] || 0; }); return row; }); import('./utils/export').then(module => module.exportToXlsx(dataForSheet, generateExportFilename('fallas_por_zona'))); }, [failureDataByZone, generateExportFilename]);
    const handleExportFailureByMunicipio = useCallback(() => { const { data: dataToExport, categories } = failureDataByMunicipio; if (dataToExport.length === 0) return; const dataForSheet = dataToExport.map(item => { const row: Record<string, any> = { 'Municipio': item.name, 'Porcentaje Fallas (%)': item.porcentaje.toFixed(2), 'Total Fallas': item.eventos, 'Total Inventario': item.totalInventario }; categories.forEach(cat => { row[cat] = item[cat] || 0; }); return row; }); import('./utils/export').then(module => module.exportToXlsx(dataForSheet, generateExportFilename('fallas_por_municipio'))); }, [failureDataByMunicipio, generateExportFilename]);
    const handleExportChangesByMunicipio = useCallback(() => { import('./utils/export').then(module => module.exportToXlsx(changesByMunicipioData, generateExportFilename('cambios_por_municipio'))); }, [changesByMunicipioData, generateExportFilename]);
    const handleExportFilteredEvents = useCallback(() => { if (displayEvents.length === 0) return; const dataForExport = displayEvents.map(event => ({ 'Fecha': event.date.toLocaleString('es-ES'), 'ID Luminaria': event.id, 'ID OLC': event.olcId, 'Municipio': event.municipio, 'Zona': event.zone, 'Estado': event.status, 'Categoría de Falla': event.failureCategory, 'Descripción': event.description, 'Potencia': event.power, 'Latitud': event.lat, 'Longitud': event.lon, })); const filename = generateExportFilename(`eventos_${currentAppState.cardFilter?.replace(/\s+/g, '_') || 'filtrados'}`); import('./utils/export').then(module => module.exportToXlsx(dataForExport, filename)); }, [displayEvents, currentAppState.cardFilter, generateExportFilename]);
    const handleExportOperatingHoursSummary = useCallback(() => { if (operatingHoursSummary.length === 0) return; const getRangeStart = (rangeStr: string): number => { if (rangeStr.startsWith('>')) return Infinity; return parseInt(rangeStr.split(' ')[0].replace(/\D/g, ''), 10); }; const dataToExport = [...operatingHoursSummary].sort((a, b) => getRangeStart(a.range) - getRangeStart(b.range)).map(item => { const row: Record<string, any> = { 'Rango de Horas': item.range, 'Total Luminarias': item.total }; operatingHoursZones.forEach(zone => { row[zone] = item[zone] || 0; }); return row; }); import('./utils/export').then(module => module.exportToXlsx(dataToExport, generateExportFilename('resumen_horas_funcionamiento'))); }, [operatingHoursSummary, operatingHoursZones, generateExportFilename]);
    const handleExportOperatingHoursDetail = useCallback(() => { if (operatingHoursDetailData.length === 0 || !currentAppState.selectedOperatingHoursRange) return; const filename = generateExportFilename(`detalle_luminarias_rango_${currentAppState.selectedOperatingHoursRange.replace(/[^\w]/g, '_')}`); const dataForExport = operatingHoursDetailData.map(item => ({ 'ID de luminaria': item.streetlightIdExterno, 'Dirección Hardware OLC': item.olcHardwareDir ?? 'N/A', 'Municipio': item.municipio, 'Latitud': item.lat ?? 'N/A', 'Longitud': item.lon ?? 'N/A' })); import('./utils/export').then(module => module.exportToXlsx(dataForExport, filename)); }, [operatingHoursDetailData, currentAppState.selectedOperatingHoursRange, generateExportFilename]);

    // PDF Export requires all data, so it's not moved to a tab component
    // It's also not available in portal view.
    // ... PDF export logic remains here ...

    if (portalTab) {
        if (!portalState) {
            return <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-200">Sincronizando...</div>;
        }

        const tabProps = {
            // Eventos Props
            baseFilteredEvents, displayEvents, oldestEventsByZone, failureDataByZone, failureDataByMunicipio,
            inaccesibleFailures, lowCurrentFailures, highCurrentFailures, voltageFailures, columnaCaidaFailures, hurtoFailures, vandalizadoFailures,
            cardFilter: currentAppState.cardFilter, 
            handleCardClick: () => {}, handleExportFailureByZone: () => {}, handleExportFailureByMunicipio: () => {}, handleExportFilteredEvents: () => {},
            // Cambios Props
            baseFilteredChangeEvents, displayChangeEvents, changesByMunicipioData,
            luminariaChangesCount, olcChangesCount, garantiaChangesCount, vandalizadoChangesCount, columnaCaidaChangesCount, hurtoChangesCount,
            cardChangeFilter: currentAppState.cardChangeFilter, searchTerm: currentAppState.searchTerm,
            handleCardChangeClick: () => {}, handleExportChangesByMunicipio: () => {}, setSearchTerm: () => {},
            // Inventario Props
            displayInventory, finalDisplayInventory, powerSummary, operatingHoursSummary, operatingHoursZones, operatingHoursDetailData, cabinetSummaryData, serviceSummaryData,
            uniqueCabinetCount, inauguratedCount, markedCount, uniqueAccountCount, vandalizadoInventoryCount, hurtoInventoryCount, columnaCaidaInventoryCount, faltaPodaInventoryCount, faltaLineaInventoryCount,
            selectedZone: currentAppState.selectedZone, isInventorySummariesOpen: currentAppState.isInventorySummariesOpen, selectedOperatingHoursRange: currentAppState.selectedOperatingHoursRange, cardInventoryFilter: currentAppState.cardInventoryFilter,
            handleCardInventoryClick: () => {}, handleExportPowerSummary: () => {}, handleExportOperatingHoursSummary: () => {}, handleExportOperatingHoursDetail: () => {},
            setIsInventorySummariesOpen: () => {}, handleExportCabinetSummary: () => {}, handleExportServiceSummary: () => {}, handleOperatingHoursRowClick: () => {},
        };

        const renderTabContent = () => {
            switch (portalTab) {
                case 'eventos': return <EventosTab {...tabProps} />;
                case 'cambios': return <CambiosTab {...tabProps} />;
                case 'inventario': return <InventarioTab {...tabProps} />;
                default: return <div>Tab no encontrado</div>;
            }
        };

        return (
            <div className="bg-gray-900 text-gray-200 font-sans p-4 h-screen overflow-y-auto">
                 <h1 className="text-2xl font-bold text-cyan-400 mb-2">
                    Ventana: {portalTab.charAt(0).toUpperCase() + portalTab.slice(1)}
                </h1>
                <p className="text-sm text-gray-400 mb-4">
                    Datos al {currentAppState.latestDataDate ? format(currentAppState.latestDataDate, 'dd/MM/yyyy') : 'N/A'}. Los filtros se controlan desde la ventana principal.
                </p>
                {renderTabContent()}
            </div>
        );
    }
    
    // --- MAIN APP RENDER ---
    const noDataLoaded = !loading && allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0;

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
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
                                <p className="text-gray-400 mb-4 text-center">Cargue planillas de datos, gestione respaldos y exporte resultados.</p>
                                <div className="w-full max-w-4xl flex flex-col items-center gap-y-3">
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
                                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* PDF Export Button (Not yet implemented for new structure) */}
                                        <button disabled={true} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                            Exportar a PDF
                                        </button>
                                        <button onClick={resetApplication} disabled={loading || noDataLoaded} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                            Reiniciar Aplicación
                                        </button>
                                    </div>
                                </div>
                                {error && <p className="text-red-400 mt-4">{error}</p>}
                                {uploadedFileNames.length > 0 && (
                                    <CollapsibleSection title={`Planillas Cargadas (${uploadedFileNames.length})`} defaultOpen={true}>
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
                                    </CollapsibleSection>
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
                             <TabButton tabId="inventario" title="Inventario" activeTab={activeTab} setActiveTab={setActiveTab} disabled={inventory.length === 0} onPopOut={handlePopOut} />
                             <TabButton tabId="cambios" title="Cambios" activeTab={activeTab} setActiveTab={setActiveTab} disabled={changeEvents.length === 0} onPopOut={handlePopOut} />
                             <TabButton tabId="eventos" title="Eventos" activeTab={activeTab} setActiveTab={setActiveTab} disabled={allEvents.length === 0} onPopOut={handlePopOut} />
                        </nav>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pt-4">
                    {loading && <div className="text-center p-8"><p>Cargando datos...</p></div>}
                    
                    {!loading && !noDataLoaded && (
                        <>
                           {activeTab === 'eventos' && allEvents.length > 0 && (
                                poppedOutTabs.includes('eventos') ? (
                                    <div className="text-center p-16 bg-gray-800 rounded-lg">
                                        <h2 className="text-2xl font-semibold text-gray-300">Pestaña Activa en Otra Ventana</h2>
                                        <p className="text-gray-500 mt-2">
                                            El contenido de la pestaña "Eventos" se está mostrando en una ventana separada.
                                            Cierre esa ventana para volver a ver el contenido aquí.
                                        </p>
                                    </div>
                                ) : (
                                    <EventosTab 
                                        baseFilteredEvents={baseFilteredEvents}
                                        displayEvents={displayEvents}
                                        oldestEventsByZone={oldestEventsByZone}
                                        failureDataByZone={failureDataByZone}
                                        failureDataByMunicipio={failureDataByMunicipio}
                                        inaccesibleFailures={inaccesibleFailures}
                                        lowCurrentFailures={lowCurrentFailures}
                                        highCurrentFailures={highCurrentFailures}
                                        voltageFailures={voltageFailures}
                                        columnaCaidaFailures={columnaCaidaFailures}
                                        hurtoFailures={hurtoFailures}
                                        vandalizadoFailures={vandalizadoFailures}
                                        cardFilter={cardFilter}
                                        handleCardClick={handleCardClick}
                                        handleExportFailureByZone={handleExportFailureByZone}
                                        handleExportFailureByMunicipio={handleExportFailureByMunicipio}
                                        handleExportFilteredEvents={handleExportFilteredEvents}
                                    />
                                )
                           )}
                           {activeTab === 'cambios' && changeEvents.length > 0 && (
                                poppedOutTabs.includes('cambios') ? (
                                    <div className="text-center p-16 bg-gray-800 rounded-lg">
                                        <h2 className="text-2xl font-semibold text-gray-300">Pestaña Activa en Otra Ventana</h2>
                                        <p className="text-gray-500 mt-2">
                                            El contenido de la pestaña "Cambios" se está mostrando en una ventana separada.
                                            Cierre esa ventana para volver a ver el contenido aquí.
                                        </p>
                                    </div>
                                ) : (
                                    <CambiosTab 
                                        baseFilteredChangeEvents={baseFilteredChangeEvents}
                                        displayChangeEvents={displayChangeEvents}
                                        changesByMunicipioData={changesByMunicipioData}
                                        luminariaChangesCount={luminariaChangesCount}
                                        olcChangesCount={olcChangesCount}
                                        garantiaChangesCount={garantiaChangesCount}
                                        vandalizadoChangesCount={vandalizadoChangesCount}
                                        columnaCaidaChangesCount={columnaCaidaChangesCount}
                                        hurtoChangesCount={hurtoChangesCount}
                                        cardChangeFilter={cardChangeFilter}
                                        searchTerm={searchTerm}
                                        handleCardChangeClick={handleCardChangeClick}
                                        handleExportChangesByMunicipio={handleExportChangesByMunicipio}
                                        setSearchTerm={setSearchTerm}
                                    />
                                )
                           )}
                           {activeTab === 'inventario' && inventory.length > 0 && (
                                poppedOutTabs.includes('inventario') ? (
                                    <div className="text-center p-16 bg-gray-800 rounded-lg">
                                        <h2 className="text-2xl font-semibold text-gray-300">Pestaña Activa en Otra Ventana</h2>
                                        <p className="text-gray-500 mt-2">
                                            El contenido de la pestaña "Inventario" se está mostrando en una ventana separada.
                                            Cierre esa ventana para volver a ver el contenido aquí.
                                        </p>
                                    </div>
                                ) : (
                                   <InventarioTab 
                                        displayInventory={displayInventory}
                                        finalDisplayInventory={finalDisplayInventory}
                                        powerSummary={powerSummary}
                                        operatingHoursSummary={operatingHoursSummary}
                                        operatingHoursZones={operatingHoursZones}
                                        operatingHoursDetailData={operatingHoursDetailData}
                                        cabinetSummaryData={cabinetSummaryData}
                                        serviceSummaryData={serviceSummaryData}
                                        uniqueCabinetCount={uniqueCabinetCount}
                                        inauguratedCount={inauguratedCount}
                                        markedCount={markedCount}
                                        uniqueAccountCount={uniqueAccountCount}
                                        vandalizadoInventoryCount={vandalizadoInventoryCount}
                                        hurtoInventoryCount={hurtoInventoryCount}
                                        columnaCaidaInventoryCount={columnaCaidaInventoryCount}
                                        faltaPodaInventoryCount={faltaPodaInventoryCount}
                                        faltaLineaInventoryCount={faltaLineaInventoryCount}
                                        selectedZone={selectedZone}
                                        isInventorySummariesOpen={isInventorySummariesOpen}
                                        selectedOperatingHoursRange={selectedOperatingHoursRange}
                                        cardInventoryFilter={cardInventoryFilter}
                                        handleCardInventoryClick={handleCardInventoryClick}
                                        handleExportPowerSummary={handleExportPowerSummary}
                                        handleExportOperatingHoursSummary={handleExportOperatingHoursSummary}
                                        handleExportOperatingHoursDetail={handleExportOperatingHoursDetail}
                                        setIsInventorySummariesOpen={setIsInventorySummariesOpen}
                                        handleExportCabinetSummary={handleExportCabinetSummary}
                                        handleExportServiceSummary={handleExportServiceSummary}
                                        handleOperatingHoursRowClick={handleOperatingHoursRowClick}
                                   />
                               )
                           )}
                        </>
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