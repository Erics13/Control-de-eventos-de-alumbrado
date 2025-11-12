
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
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
import { parse } from 'date-fns/parse';

import { useLuminaireData } from './hooks/useLuminaireData';
import { useBroadcastChannel } from './hooks/useBroadcastChannel';
import { useAuth } from './hooks/useAuth';
import type { LuminaireEvent, InventoryItem, ActiveTab, ChangeEvent, BroadcastMessage, HistoricalData, HistoricalZoneData, ServicePoint, ZoneBase, UserProfile } from './types';
import { ALL_ZONES, MUNICIPIO_TO_ZONE_MAP, ZONE_ORDER } from './constants';

import Header from './components/Header';
// FIX: Changed to a named import as FilterControls does not have a default export.
import { FilterControls } from './components/FilterControls';
import TabButton from './components/TabButton';
import EventosTab from './components/EventosTab';
import CambiosTab from './components/CambiosTab';
import InventarioTab from './components/InventarioTab';
import HistorialTab from './components/HistorialTab';
import MantenimientoTab from './components/RutasTab';
import AdminTab from './components/AdminTab';
import MapModal from './components/MapModal';
import AuthPage from './components/AuthPage';
import { exportToXlsxMultiSheet, exportToXlsx } from './utils/export';

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
    selectedChangesYear: string;
    // Card Filters
    cardFilter: string | null;
    cardChangeFilter: string | null;
    cardInventoryFilter: { key: keyof InventoryItem; value: string } | null;
    // UI State
    isInventorySummariesOpen: boolean;
    selectedOperatingHoursRange: string | null;
    latestDataDate: Date | null;
    selectedHistoricalMonthZone: { month: string, zone: string } | null;
    selectedZoneForCabinetDetails: string | null;
    // Auth State
    userProfile: UserProfile | null;
}

const App: React.FC = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const portalTab = urlParams.get('portal') as ActiveTab | null;
    const { user, userProfile, loading: authLoading } = useAuth();
    
    const {
        allEvents, changeEvents, inventory, servicePoints, zoneBases, historicalData,
        loading: dataLoading, error: dataError
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
    const [selectedChangesYear, setSelectedChangesYear] = useState<string>('');
    const [cardFilter, setCardFilter] = useState<string | null>(null);
    const [cardChangeFilter, setCardChangeFilter] = useState<string | null>(null);
    const [cardInventoryFilter, setCardInventoryFilter] = useState<{key: keyof InventoryItem, value: string} | null>(null);
    const [isFiltersVisible, setIsFiltersVisible] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('inventario');
    const [isInventorySummariesOpen, setIsInventorySummariesOpen] = useState(false);
    const [selectedOperatingHoursRange, setSelectedOperatingHoursRange] = useState<string | null>(null);
    const [selectedHistoricalMonthZone, setSelectedHistoricalMonthZone] = useState<{ month: string, zone: string } | null>(null);
    const [selectedZoneForCabinetDetails, setSelectedZoneForCabinetDetails] = useState<string | null>(null);

    // Map Modal State
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [mapModalData, setMapModalData] = useState<{ title: string; servicePoints: ServicePoint[] }>({ title: '', servicePoints: [] });


    // New state for windowing
    const [poppedOutTabs, setPoppedOutTabs] = useState<ActiveTab[]>([]);
    const [portalState, setPortalState] = useState<FullAppState | null>(null);
    const isMainApp = useRef(!portalTab);
    
     // --- Role-Based Access Control ---
    useEffect(() => {
        if ((userProfile?.role === 'capataz' || userProfile?.role === 'cuadrilla') && userProfile.zone && typeof userProfile.zone === 'string') {
            setSelectedZone(userProfile.zone);
        } else if (userProfile?.role === 'regional' || userProfile?.role === 'administrador') {
            // For regional and admin, allow them to see all (their) zones.
            // The data is pre-filtered for regional users.
        }
    }, [userProfile]);

    const dataForUser = useMemo(() => {
        if (!userProfile) {
            return { allEvents, changeEvents, inventory, servicePoints, zoneBases, historicalData };
        }
        const { role, zone } = userProfile;
    
        if ((role === 'capataz' || role === 'cuadrilla') && zone && typeof zone === 'string') {
            return {
                allEvents: allEvents.filter(e => e.zone === zone),
                changeEvents: changeEvents.filter(e => e.zone === zone),
                inventory: inventory.filter(i => i.zone === zone),
                servicePoints: servicePoints, // Keep all service points for now, can be filtered if needed
                zoneBases: zoneBases.filter(b => b.zoneName === zone),
                historicalData, // Historical data is filtered later in its own memo
            };
        }
    
        if (role === 'regional' && zone && Array.isArray(zone)) {
            const userZones = new Set(zone);
            return {
                allEvents: allEvents.filter(e => e.zone && userZones.has(e.zone)),
                changeEvents: changeEvents.filter(e => e.zone && userZones.has(e.zone)),
                inventory: inventory.filter(i => i.zone && userZones.has(i.zone)),
                servicePoints: servicePoints, // Keep all service points for now, can be filtered if needed
                zoneBases: zoneBases.filter(b => userZones.has(b.zoneName)),
                historicalData, // Historical data is filtered later in its own memo
            };
        }
    
        // Admin or other roles see everything
        return { allEvents, changeEvents, inventory, servicePoints, zoneBases, historicalData };
    }, [userProfile, allEvents, changeEvents, inventory, servicePoints, zoneBases, historicalData]);


    const latestDataDate = useMemo(() => {
        const allDates: number[] = [];
        dataForUser.allEvents.forEach(e => { if (e.date) allDates.push(e.date.getTime()); });
        dataForUser.changeEvents.forEach(e => { if (e.fechaRetiro) allDates.push(e.fechaRetiro.getTime()); });
        dataForUser.inventory.forEach(i => { if (i.ultimoInforme) allDates.push(i.ultimoInforme.getTime()); });
        if (allDates.length === 0) return null;
        return new Date(Math.max(...allDates));
    }, [dataForUser.allEvents, dataForUser.changeEvents, dataForUser.inventory]);

    // ---- Broadcast Channel Logic ----
    const handleBroadcastMessage = useCallback((message: BroadcastMessage) => {
        const { type, payload } = message as { type: string, payload: any };

        if (isMainApp.current) { 
            if (type === 'DOCK_TAB') {
                setPoppedOutTabs(prev => prev.filter(t => t !== payload));
            }
             if (type === 'REQUEST_INITIAL_STATE') {
                const currentState: FullAppState = {
                    dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
                    selectedPower, selectedCalendar, searchTerm, selectedChangesYear, cardFilter, cardChangeFilter, cardInventoryFilter,
                    isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate, selectedHistoricalMonthZone,
                    selectedZoneForCabinetDetails, userProfile
                };
                 postMessage({ type: 'INITIAL_STATE_RESPONSE', payload: currentState });
            }
        } else { 
            if (type === 'STATE_UPDATE' || type === 'INITIAL_STATE_RESPONSE') {
                const receivedState = payload as FullAppState;
                const newDateRange = {
                    start: receivedState.dateRange.start ? new Date(receivedState.dateRange.start) : null,
                    end: receivedState.dateRange.end ? new Date(receivedState.dateRange.end) : null
                };
                const newLatestDate = receivedState.latestDataDate ? new Date(receivedState.latestDataDate) : null;
                setPortalState({ ...receivedState, dateRange: newDateRange, latestDataDate: newLatestDate });
            }
        }
    }, [isMainApp.current, dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear, selectedPower, selectedCalendar, searchTerm, selectedChangesYear, cardFilter, cardChangeFilter, cardInventoryFilter, isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate, selectedHistoricalMonthZone, selectedZoneForCabinetDetails, userProfile]);

    const { postMessage } = useBroadcastChannel(handleBroadcastMessage);

    // Effect for main app to broadcast state changes
    useEffect(() => {
        if (isMainApp.current) {
            const fullState: FullAppState = {
                dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
                selectedPower, selectedCalendar, searchTerm, selectedChangesYear, cardFilter, cardChangeFilter, cardInventoryFilter,
                isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate, selectedHistoricalMonthZone,
                selectedZoneForCabinetDetails, userProfile,
            };
            postMessage({ type: 'STATE_UPDATE', payload: fullState });
        }
    }, [
        dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
        selectedPower, selectedCalendar, searchTerm, selectedChangesYear, cardFilter, cardChangeFilter, cardInventoryFilter,
        isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate, selectedHistoricalMonthZone, selectedZoneForCabinetDetails, postMessage, userProfile
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
    useEffect(() => { if (dataLoading || !userProfile) return; const hasInventory = dataForUser.inventory.length > 0; const hasChanges = dataForUser.changeEvents.length > 0; const hasEvents = dataForUser.allEvents.length > 0; const hasHistory = Object.keys(dataForUser.historicalData).length > 0; const hasMantenimiento = dataForUser.allEvents.length > 0 && dataForUser.inventory.length > 0; const hasAdmin = userProfile.role === 'administrador'; const tabs: { id: ActiveTab; hasData: boolean }[] = [ { id: 'inventario', hasData: hasInventory }, { id: 'cambios', hasData: hasChanges }, { id: 'eventos', hasData: hasEvents }, { id: 'historial', hasData: hasHistory }, { id: 'mantenimiento', hasData: hasMantenimiento }, { id: 'admin', hasData: hasAdmin }]; const currentTab = tabs.find(t => t.id === activeTab); if (currentTab && !currentTab.hasData) { const firstAvailableTab = tabs.find(t => t.hasData); if (firstAvailableTab) { setActiveTab(firstAvailableTab.id as ActiveTab); } } else if (!hasInventory && !hasChanges && !hasEvents && !hasHistory && !hasMantenimiento && !hasAdmin) { setActiveTab('inventario'); } }, [dataForUser.inventory.length, dataForUser.changeEvents.length, dataForUser.allEvents.length, dataForUser.historicalData, activeTab, dataLoading, userProfile]);

    const handleOperatingHoursRowClick = useCallback((range: string) => { setSelectedOperatingHoursRange(prev => (prev === range ? null : range)); }, []);
    const handleCabinetZoneRowClick = useCallback((zoneName: string) => { setSelectedZoneForCabinetDetails(prev => prev === zoneName ? null : zoneName); }, []);
    
    const handlePopOut = (tabId: ActiveTab) => {
        window.open(`/?portal=${tabId}`, `portal_${tabId}`, 'width=1200,height=800,resizable=yes,scrollbars=yes');
        setPoppedOutTabs(prev => [...prev, tabId]);
    };

    // Use portal state if available, otherwise use main app state
    const currentAppState = portalState || {
        dateRange, selectedZone, selectedMunicipio, selectedCategory, selectedMonth, selectedYear,
        selectedPower, selectedCalendar, searchTerm, selectedChangesYear, cardFilter, cardChangeFilter, cardInventoryFilter,
        isInventorySummariesOpen, selectedOperatingHoursRange, latestDataDate, selectedHistoricalMonthZone,
        selectedZoneForCabinetDetails, userProfile
    };
    
    // --- All data calculations are performed once, based on the current state ---
    const baseFilteredEvents = useMemo(() => { return dataForUser.allEvents.filter(event => { const eventDate = typeof event.date === 'string' ? parseISO(event.date) : event.date; let isDateInRange = true; if (currentAppState.dateRange.start && currentAppState.dateRange.end) { isDateInRange = isWithinInterval(eventDate, { start: currentAppState.dateRange.start, end: currentAppState.dateRange.end }); } else if (currentAppState.selectedMonth && !currentAppState.selectedYear) { isDateInRange = (eventDate.getMonth() + 1) === parseInt(currentAppState.selectedMonth, 10); } const isZoneMatch = currentAppState.selectedZone === 'all' || event.zone === currentAppState.selectedZone; const isMunicipioMatch = currentAppState.selectedMunicipio === 'all' || event.municipio === currentAppState.selectedMunicipio; const isCategoryMatch = currentAppState.selectedCategory === 'all' || event.failureCategory === currentAppState.selectedCategory; return isDateInRange && isZoneMatch && isMunicipioMatch && isCategoryMatch; }); }, [dataForUser.allEvents, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, currentAppState.selectedCategory, currentAppState.selectedMonth, currentAppState.selectedYear]);
    const baseFilteredChangeEvents = useMemo(() => { return dataForUser.changeEvents.filter(event => { const eventDate = event.fechaRetiro; let isDateInRange = true; if (currentAppState.dateRange.start && currentAppState.dateRange.end) { isDateInRange = isWithinInterval(eventDate, { start: currentAppState.dateRange.start, end: currentAppState.dateRange.end }); } else if (currentAppState.selectedMonth && !currentAppState.selectedYear) { isDateInRange = (eventDate.getMonth() + 1) === parseInt(currentAppState.selectedMonth, 10); } const isZoneMatch = currentAppState.selectedZone === 'all' || event.zone === currentAppState.selectedZone; const isMunicipioMatch = currentAppState.selectedMunicipio === 'all' || event.municipio === currentAppState.selectedMunicipio; const searchLower = currentAppState.searchTerm.toLowerCase().trim(); if (searchLower === '') { return isDateInRange && isZoneMatch && isMunicipioMatch; } const normalizedSearchTerm = searchLower.replace(/:/g, '').replace(/\s/g, ''); const isSearchMatch = (event.poleIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) || (event.streetlightIdExterno || '').toLowerCase().replace(/:/g, '').replace(/\s/g, '').includes(normalizedSearchTerm) || (event.componente || '').toLowerCase().includes(searchLower) || (event.designacionTipo || '').toLowerCase().includes(searchLower) || (event.cabinetIdExterno || '').toLowerCase().includes(searchLower); return isDateInRange && isZoneMatch && isMunicipioMatch && isSearchMatch; }); }, [dataForUser.changeEvents, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, currentAppState.searchTerm, currentAppState.selectedMonth, currentAppState.selectedYear]);
    const displayInventory = useMemo(() => { return dataForUser.inventory.filter(item => { const relevantDate = item.fechaInauguracion && item.fechaInstalacion ? (item.fechaInauguracion > item.fechaInstalacion ? item.fechaInauguracion : item.fechaInstalacion) : item.fechaInauguracion || item.fechaInstalacion; let isDateInRange = true; if (relevantDate && currentAppState.dateRange.start && currentAppState.dateRange.end) { isDateInRange = isWithinInterval(relevantDate, { start: currentAppState.dateRange.start, end: currentAppState.dateRange.end }); } const isZoneMatch = currentAppState.selectedZone === 'all' || item.zone === currentAppState.selectedZone; const isMunicipioMatch = currentAppState.selectedMunicipio === 'all' || item.municipio === currentAppState.selectedMunicipio; const isPowerMatch = currentAppState.selectedPower === 'all' || String(item.potenciaNominal) === currentAppState.selectedPower; const isCalendarMatch = currentAppState.selectedCalendar === 'all' || item.dimmingCalendar === currentAppState.selectedCalendar; return isDateInRange && isZoneMatch && isMunicipioMatch && isPowerMatch && isCalendarMatch; }); }, [dataForUser.inventory, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, currentAppState.selectedPower, currentAppState.selectedCalendar]);
    const finalDisplayInventory = useMemo(() => { if (!currentAppState.cardInventoryFilter) { return displayInventory; } return displayInventory.filter(item => { const itemValue = item[currentAppState.cardInventoryFilter.key]; if (typeof itemValue !== 'string') { return false; } const filterValue = currentAppState.cardInventoryFilter.value.toUpperCase().trim(); const processedItemValue = itemValue.toUpperCase().trim(); if (currentAppState.cardInventoryFilter.key === 'situacion' && filterValue === 'VANDALIZADO') { return processedItemValue.startsWith('VANDALIZADO'); } return processedItemValue === filterValue; }); }, [displayInventory, currentAppState.cardInventoryFilter]);
    const displayEvents = useMemo(() => { if (!currentAppState.cardFilter) { return baseFilteredEvents; } switch (currentAppState.cardFilter) { case 'lowCurrent': return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_LOW_CURRENT); case 'highCurrent': return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_HIGH_CURRENT); case 'voltage': return baseFilteredEvents.filter(e => e.description.trim() === ERROR_DESC_VOLTAGE); case 'columnaCaida': return baseFilteredEvents.filter(e => e.failureCategory === 'Columna Caída'); case 'hurto': return baseFilteredEvents.filter(e => e.failureCategory === 'Hurto'); case 'vandalizado': return baseFilteredEvents.filter(e => e.failureCategory === 'Vandalizado'); case 'inaccesible': return baseFilteredEvents.filter(e => e.failureCategory === 'Inaccesible'); default: return baseFilteredEvents; } }, [baseFilteredEvents, currentAppState.cardFilter]);
    const displayChangeEvents = useMemo(() => { if (!currentAppState.cardChangeFilter) { return baseFilteredChangeEvents; } switch (currentAppState.cardChangeFilter) { case 'luminaria': return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('LUMINARIA')); case 'olc': return baseFilteredChangeEvents.filter(e => e.componente.toUpperCase().includes('OLC')); case 'garantia': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'garantia'); case 'vandalizado': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'vandalizado'); case 'columnaCaidaChange': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'columna caída'); case 'hurtoChange': return baseFilteredChangeEvents.filter(e => e.condicion.toLowerCase() === 'hurto'); default: return baseFilteredChangeEvents; } }, [baseFilteredChangeEvents, currentAppState.cardChangeFilter]);
    
    // --- Memoized derived data for charts and tables ---
    const failureCategories = useMemo(() => { const categories = new Set(dataForUser.allEvents.map(e => e.failureCategory).filter((c): c is string => !!c)); return Array.from(categories).sort(); }, [dataForUser.allEvents]);
    const zones = useMemo(() => { const zoneSet = new Set([...dataForUser.allEvents.map(e => e.zone), ...dataForUser.changeEvents.map(e => e.zone), ...dataForUser.inventory.map(i => i.zone)]); return Array.from(zoneSet).sort(); }, [dataForUser.allEvents, dataForUser.changeEvents, dataForUser.inventory]);
    const municipios = useMemo(() => { const municipioSet = new Set([...dataForUser.allEvents.map(e => e.municipio), ...dataForUser.changeEvents.map(e => e.municipio), ...dataForUser.inventory.map(i => i.municipio)]); return Array.from(municipioSet).sort(); }, [dataForUser.allEvents, dataForUser.changeEvents, dataForUser.inventory]);
    const filteredMunicipios = useMemo(() => { if (currentAppState.selectedZone === 'all') { return municipios; } return municipios.filter(m => MUNICIPIO_TO_ZONE_MAP[m.toUpperCase()] === currentAppState.selectedZone); }, [currentAppState.selectedZone, municipios]);
    useEffect(() => { if (isMainApp.current && selectedMunicipio !== 'all' && !filteredMunicipios.includes(selectedMunicipio)) { setSelectedMunicipio('all'); } }, [selectedZone, filteredMunicipios, selectedMunicipio]);
    const availableYears = useMemo(() => { if (dataForUser.allEvents.length === 0 && dataForUser.changeEvents.length === 0) return []; const years = new Set<string>(); dataForUser.allEvents.forEach(event => { years.add(format(event.date, 'yyyy')); }); dataForUser.changeEvents.forEach(event => { years.add(format(event.fechaRetiro, 'yyyy')); }); return Array.from(years).sort((a: string, b: string) => parseInt(b) - parseInt(a)); }, [dataForUser.allEvents, dataForUser.changeEvents]);
    const availablePowers = useMemo(() => { const powers = new Set(dataForUser.inventory.map(i => i.potenciaNominal).filter((p): p is number => p != null)); return Array.from(powers).sort((a: number, b: number) => a - b).map(String); }, [dataForUser.inventory]);
    const availableCalendars = useMemo(() => { const calendars = new Set(dataForUser.inventory.map(i => i.dimmingCalendar).filter((c): c is string => !!c && c !== '-')); return Array.from(calendars).sort(); }, [dataForUser.inventory]);
    
    useEffect(() => {
        if (availableYears.length > 0 && !selectedChangesYear) {
            setSelectedChangesYear(availableYears[0]);
        }
    }, [availableYears, selectedChangesYear]);

    // --- Metrics Calculations ---
    const uniqueCabinetCount = useMemo(() => new Set(displayInventory.map(i => i.cabinetIdExterno).filter((c): c is string => !!c && c.trim() !== '' && c.trim() !== '-')).size, [displayInventory]);
    const inauguratedCount = useMemo(() => displayInventory.filter(item => item.fechaInauguracion).length, [displayInventory]);
    const markedCount = useMemo(() => dataForUser.inventory.filter(item => item.marked?.trim().toUpperCase() === 'YES').length, [dataForUser.inventory]);
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
    const oldestEventsByZone = useMemo(() => { if (dataForUser.allEvents.length === 0) return []; const map = new Map<string, LuminaireEvent>(); for (let i = dataForUser.allEvents.length - 1; i >= 0; i--) { const event = dataForUser.allEvents[i]; if (!map.has(event.zone)) { map.set(event.zone, event); } } return Array.from(map.values()).sort((a, b) => a.zone.localeCompare(b.zone)); }, [dataForUser.allEvents]);
    const inventoryCountByZone = useMemo(() => dataForUser.inventory.reduce((acc, item) => { if (item.zone) { acc[item.zone] = (acc[item.zone] || 0) + 1; } return acc; }, {} as Record<string, number>), [dataForUser.inventory]);
    const filteredFailureCategories = useMemo(() => { const order = ['Inaccesible', 'Roto', 'Error de configuración', 'Falla de hardware', 'Falla de voltaje', 'Hurto', 'Vandalizado', 'Columna Caída']; const allCats = Array.from(new Set(baseFilteredEvents.map(e => e.failureCategory).filter((c): c is string => !!c))); return allCats.sort((a: string, b: string) => { const iA = order.indexOf(a); const iB = order.indexOf(b); if (iA !== -1 && iB !== -1) return iA - iB; if (iA !== -1) return -1; if (iB !== -1) return 1; return a.localeCompare(b); }); }, [baseFilteredEvents]);
    const failureDataByZone = useMemo(() => {
        if (Object.keys(inventoryCountByZone).length === 0) return { data: [], categories: [] };
        const counts = baseFilteredEvents.reduce((acc, event) => {
            if (event.zone) {
                if (!acc[event.zone]) {
                    acc[event.zone] = { total: 0, categories: {} };
                }
                acc[event.zone].total++;
                if (event.failureCategory) {
                    acc[event.zone].categories[event.failureCategory] = (acc[event.zone].categories[event.failureCategory] || 0) + 1;
                }
            }
            return acc;
        }, {} as Record<string, { total: number; categories: Record<string, number> }>);
        const data = Object.keys(inventoryCountByZone).map(zone => {
            const eventData = counts[zone] || { total: 0, categories: {} };
            const totalInventario = inventoryCountByZone[zone];
            const rowData: { name: string; eventos: number; totalInventario: number; porcentaje: number; [key: string]: any; } = {
                name: zone,
                eventos: eventData.total,
                totalInventario,
                porcentaje: totalInventario > 0 ? (eventData.total / totalInventario) * 100 : 0
            };
            filteredFailureCategories.forEach(cat => {
                rowData[cat] = eventData.categories[cat] || 0;
            });
            return rowData;
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
        const relevantInventory = displayInventory;
        const inventoryCountByMunicipio = relevantInventory.reduce((acc, item) => {
             if (item.municipio) { acc[item.municipio] = (acc[item.municipio] || 0) + 1; }
             return acc;
        }, {} as Record<string, number>);

        if (Object.keys(inventoryCountByMunicipio).length === 0) return { data: [], categories: [] };
        
        const counts = baseFilteredEvents.reduce((acc, event) => {
            if (event.municipio) {
                if (!acc[event.municipio]) {
                    acc[event.municipio] = { total: 0, categories: {} };
                }
                acc[event.municipio].total++;
                if (event.failureCategory) {
                    acc[event.municipio].categories[event.failureCategory] = (acc[event.municipio].categories[event.failureCategory] || 0) + 1;
                }
            }
            return acc;
        }, {} as Record<string, { total: number; categories: Record<string, number> }>);

        const data = Object.keys(inventoryCountByMunicipio).map(muni => {
            const eventData = counts[muni] || { total: 0, categories: {} };
            const totalInventario = inventoryCountByMunicipio[muni];
            const rowData: { name: string; eventos: number; totalInventario: number; porcentaje: number; [key: string]: any; } = {
                name: muni,
                eventos: eventData.total,
                totalInventario,
                porcentaje: totalInventario > 0 ? (eventData.total / totalInventario) * 100 : 0,
            };
            filteredFailureCategories.forEach(cat => {
                rowData[cat] = eventData.categories[cat] || 0;
            });
            return rowData;
        }).sort((a,b) => b.porcentaje - a.porcentaje);

        return { data, categories: filteredFailureCategories };
    }, [baseFilteredEvents, displayInventory, filteredFailureCategories]);

    const changesByMunicipioData = useMemo(() => { const counts = baseFilteredChangeEvents.reduce((acc, event) => { if (!event.municipio) return acc; if (!acc[event.municipio]) acc[event.municipio] = { LUMINARIA: 0, OLC: 0, total: 0 }; const component = event.componente.toUpperCase(); if (component.includes('LUMINARIA')) { acc[event.municipio].LUMINARIA++; acc[event.municipio].total++; } else if (component.includes('OLC')) { acc[event.municipio].OLC++; acc[event.municipio].total++; } return acc; }, {} as Record<string, { LUMINARIA: number; OLC: number; total: number }>); return Object.entries(counts).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total); }, [baseFilteredChangeEvents]);
    const cabinetSummaryData = useMemo(() => { const counts = dataForUser.inventory.reduce((acc, item) => { if (item.cabinetIdExterno) acc[item.cabinetIdExterno] = (acc[item.cabinetIdExterno] || 0) + 1; return acc; }, {} as Record<string, number>); return Object.entries(counts).map(([cabinetId, luminaireCount]) => ({ cabinetId, luminaireCount })).filter(item => item.cabinetId && item.cabinetId !== '-' && item.cabinetId.trim() !== ''); }, [dataForUser.inventory]);
    const serviceSummaryData = useMemo(() => { const map = dataForUser.inventory.reduce((acc, item) => { if (item.nroCuenta && item.nroCuenta.trim() !== '' && item.nroCuenta.trim() !== '-') { const cuenta = item.nroCuenta.trim(); if (!acc.has(cuenta)) acc.set(cuenta, { luminaireCount: 0, totalPower: 0 }); const summary = acc.get(cuenta)!; summary.luminaireCount += 1; summary.totalPower += item.potenciaNominal || 0; } return acc; }, new Map<string, { luminaireCount: number; totalPower: number }>()); return Array.from(map.entries()).map(([nroCuenta, data]) => ({ nroCuenta, luminaireCount: data.luminaireCount, totalPower: data.totalPower })); }, [dataForUser.inventory]);
    const powerSummary = useMemo(() => { const items = finalDisplayInventory; if (items.length === 0) return { powerData: [], locationColumns: [], columnTotals: {}, grandTotal: 0 }; const isGroupingByZone = currentAppState.selectedZone === 'all'; const locationColumns: string[] = isGroupingByZone ? ALL_ZONES.filter(zone => items.some(item => item.zone === zone)) : Array.from(new Set<string>(items.map(item => item.municipio).filter((m): m is string => !!m))).sort(); const powers: number[] = Array.from(new Set<number>(items.map(item => item.potenciaNominal).filter((p): p is number => p != null))).sort((a, b) => a - b); const powerMap = new Map<number, Record<string, number>>(); for (const item of items) { if (item.potenciaNominal != null) { if (!powerMap.has(item.potenciaNominal)) powerMap.set(item.potenciaNominal, {}); const powerRow = powerMap.get(item.potenciaNominal)!; const location = isGroupingByZone ? item.zone : item.municipio; if (location) powerRow[location] = (powerRow[location] || 0) + 1; } } const powerData = powers.map(power => { const rowData: Record<string, number> = powerMap.get(power) || {}; const total = locationColumns.reduce((sum, loc) => sum + (rowData[loc] || 0), 0); const result: {[key: string]: any} = { power: `${power}W`, total }; locationColumns.forEach(loc => { result[loc] = (rowData as any)[loc] || 0; }); return result; }); const columnTotals: Record<string, number> = {}; let grandTotal = 0; locationColumns.forEach(loc => { const total = powerData.reduce((sum, row) => sum + ((row as any)[loc] || 0), 0); columnTotals[loc] = total; grandTotal += total; }); return { powerData, locationColumns, columnTotals, grandTotal }; }, [finalDisplayInventory, currentAppState.selectedZone]);
    const { operatingHoursSummary, operatingHoursZones } = useMemo(() => { const items = dataForUser.inventory; if (items.length === 0) return { operatingHoursSummary: [], operatingHoursZones: [] }; const RANGE_STEP = 5000, MAX_HOURS = 100000; const presentZones = new Set<string>(); const countsByRange = items.reduce((acc, item) => { if (item.horasFuncionamiento != null && item.horasFuncionamiento >= 0 && item.zone) { let rangeLabel; if (item.horasFuncionamiento > MAX_HOURS) rangeLabel = `> ${MAX_HOURS.toLocaleString('es-ES')} hs`; else if (item.horasFuncionamiento <= RANGE_STEP) rangeLabel = `0 - ${RANGE_STEP.toLocaleString('es-ES')} hs`; else { const rangeIndex = Math.floor((item.horasFuncionamiento - 1) / RANGE_STEP); const rangeStart = rangeIndex * RANGE_STEP + 1; const rangeEnd = (rangeIndex + 1) * RANGE_STEP; rangeLabel = `${rangeStart.toLocaleString('es-ES')} - ${rangeEnd.toLocaleString('es-ES')} hs`; } if (!acc[rangeLabel]) acc[rangeLabel] = { total: 0 }; acc[rangeLabel].total = (acc[rangeLabel].total || 0) + 1; acc[rangeLabel][item.zone] = (acc[rangeLabel][item.zone] || 0) + 1; presentZones.add(item.zone); } return acc; }, {} as Record<string, { total: number; [zone: string]: number }>); const sortedZones = Array.from(presentZones).sort((a, b) => { const iA = ZONE_ORDER.indexOf(a); const iB = ZONE_ORDER.indexOf(b); if (iA !== -1 && iB !== -1) return iA - iB; if (iA !== -1) return -1; if (iB !== -1) return 1; return a.localeCompare(b); }); const summary = Object.entries(countsByRange).map(([range, counts]) => { const item: Record<string, any> = { range }; for (const key in counts) { item[key] = counts[key as keyof typeof counts]; } return item; }); return { operatingHoursSummary: summary, operatingHoursZones: sortedZones }; }, [dataForUser.inventory]);
    const operatingHoursDetailData = useMemo((): InventoryItem[] => { if (!currentAppState.selectedOperatingHoursRange) return []; const parseRange = (rangeStr: string): { start: number; end: number } => { if (rangeStr.startsWith('>')) { const start = parseInt(rangeStr.replace(/\D/g, ''), 10); return { start, end: Infinity }; } const parts = rangeStr.replace(/ hs/g, '').replace(/\./g, '').split(' - '); return { start: parseInt(parts[0], 10), end: parseInt(parts[1], 10) }; }; const { start, end } = parseRange(currentAppState.selectedOperatingHoursRange); return dataForUser.inventory.filter(item => { if (item.horasFuncionamiento == null) return false; if (end === Infinity) return item.horasFuncionamiento > start; return item.horasFuncionamiento >= start && item.horasFuncionamiento <= end; }); }, [dataForUser.inventory, currentAppState.selectedOperatingHoursRange]);
    
     // --- Historical Data Calculations ---
    const luminaireIdToInfoMap = useMemo(() => {
        const map = new Map<string, { zone: string; municipio: string }>();
        dataForUser.inventory.forEach(item => {
            if (item.streetlightIdExterno && item.zone && item.municipio) {
                map.set(item.streetlightIdExterno, { zone: item.zone, municipio: item.municipio });
            }
        });
        return map;
    }, [dataForUser.inventory]);

    const filteredHistoricalData = useMemo(() => {
        const dataToFilter = dataForUser.historicalData;
        const range = currentAppState.dateRange;
        const zone = currentAppState.selectedZone;
        const municipio = currentAppState.selectedMunicipio;

        let targetZone: string | null = null;
        if (zone !== 'all') {
            targetZone = zone;
        } else if (municipio !== 'all') {
            targetZone = MUNICIPIO_TO_ZONE_MAP[municipio.toUpperCase()] || null;
        }
        
        if (!range.start && !range.end) {
            return dataToFilter; // Return all if no date range
        }
        const filtered: HistoricalData = {};
        const start = range.start ? startOfDay(range.start) : null;
        const end = range.end ? endOfDay(range.end) : null;
        if (!start || !end) return dataToFilter;

        Object.entries(dataToFilter).forEach(([dateStr, dayData]) => {
            const date = parse(dateStr, 'yyyy-MM-dd', new Date());
            if (isWithinInterval(date, { start, end })) {
                const dailyFilteredData: { [zone: string]: HistoricalZoneData } = {};
                
                if (targetZone) { // Filter by a specific zone
                    if (dayData && typeof dayData === 'object' && (dayData as any)[targetZone]) {
                        dailyFilteredData[targetZone] = (dayData as any)[targetZone];
                    }
                } else { // No zone filter, include all zones
                    if (dayData && typeof dayData === 'object') {
                        // FIX: Cast dayData to iterate in for...in loop, addressing potential 'unknown' type issue.
                        const dayDataObj = dayData as Record<string, HistoricalZoneData>;
                        for (const zoneKey in dayDataObj) {
                            if (Object.prototype.hasOwnProperty.call(dayDataObj, zoneKey)) {
                                dailyFilteredData[zoneKey] = dayDataObj[zoneKey];
                            }
                        }
                    }
                }

                if (Object.keys(dailyFilteredData).length > 0) {
                     // The cast is necessary because Object.entries/assign can lose specific index signature types.
                     filtered[dateStr] = dailyFilteredData as { [zone: string]: HistoricalZoneData };
                }
            }
        });
        return filtered;
    }, [dataForUser.historicalData, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio]);

    const { uniqueFailuresInDateRange, uniqueFailuresByZoneInDateRange } = useMemo(() => {
        if (!currentAppState.dateRange.start || !currentAppState.dateRange.end) {
            return { uniqueFailuresInDateRange: 0, uniqueFailuresByZoneInDateRange: [] };
        }
    
        const countsByZone: Record<string, Set<string>> = {};
        const zoneFilter = currentAppState.selectedZone;
        const municipioFilter = currentAppState.selectedMunicipio;
    
        const addToZone = (zone: string, id: string) => {
             if (!countsByZone[zone]) {
                countsByZone[zone] = new Set<string>();
            }
            countsByZone[zone].add(id);
        }
    
        // Process historical data
        Object.values(filteredHistoricalData).forEach(dayData => {
            if (dayData && typeof dayData === 'object') {
                Object.entries(dayData).forEach(([zoneName, zoneData]) => {
                    if (zoneData.failedLuminaireIds) {
                        zoneData.failedLuminaireIds.forEach(id => {
                            if (municipioFilter !== 'all') {
                                const luminaireInfo = luminaireIdToInfoMap.get(id);
                                if (luminaireInfo && luminaireInfo.municipio === municipioFilter) {
                                    addToZone(zoneName, id);
                                }
                            } else {
                                addToZone(zoneName, id);
                            }
                        });
                    }
                });
            }
        });
    
        // Process current day's events
        const failureEvents = dataForUser.allEvents.filter(e => e.status === 'FAILURE');
        failureEvents.forEach(event => {
            const isDateMatch = isWithinInterval(event.date, { start: currentAppState.dateRange.start!, end: currentAppState.dateRange.end! });
            const isZoneMatch = zoneFilter === 'all' || event.zone === zoneFilter;
            const isMunicipioMatch = municipioFilter === 'all' || event.municipio === municipioFilter;
    
            if (event.zone && isDateMatch && isZoneMatch && isMunicipioMatch) {
                addToZone(event.zone, event.id);
            }
        });
    
        const totalUniqueIds = new Set<string>();
        const resultByZone = Object.entries(countsByZone).map(([zone, luminaireIds]) => {
            luminaireIds.forEach(id => totalUniqueIds.add(id));
            return {
                name: zone,
                count: luminaireIds.size
            };
        });
    
        const sortedResultByZone = resultByZone.sort((a, b) => {
            const iA = ZONE_ORDER.indexOf(a.name);
            const iB = ZONE_ORDER.indexOf(b.name);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1;
            if (iB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
    
        return {
            uniqueFailuresInDateRange: totalUniqueIds.size,
            uniqueFailuresByZoneInDateRange: sortedResultByZone
        };
    
    }, [dataForUser.allEvents, filteredHistoricalData, currentAppState.dateRange, currentAppState.selectedZone, currentAppState.selectedMunicipio, luminaireIdToInfoMap]);

    const cabinetFailuresInDateRange = useMemo(() => {
        const failures: { date: Date; id: string; zone: string; municipio: string }[] = [];
    
        Object.entries(filteredHistoricalData).forEach(([dateStr, dayData]) => {
            if (dayData && typeof dayData === 'object') {
                const date = parse(dateStr, 'yyyy-MM-dd', new Date());
                Object.entries(dayData).forEach(([zoneName, zoneData]) => {
                    if (zoneData.cabinetFailureLuminaireIds) {
                        zoneData.cabinetFailureLuminaireIds.forEach(id => {
                            const luminaireInfo = luminaireIdToInfoMap.get(id);
                            failures.push({
                                date,
                                id,
                                zone: zoneName,
                                municipio: luminaireInfo?.municipio || 'Desconocido (No en Inventario)',
                            });
                        });
                    }
                });
            }
        });
    
        return failures;
    }, [filteredHistoricalData, luminaireIdToInfoMap]);

    const cabinetFailuresForSelectedMonth = useMemo(() => {
        if (!currentAppState.selectedHistoricalMonthZone) return [];

        const { month, zone } = currentAppState.selectedHistoricalMonthZone;
        const failures: { date: Date; id: string; zone: string; municipio: string }[] = [];

        Object.entries(dataForUser.historicalData).forEach(([dateStr, dayData]) => {
            if (dateStr.startsWith(month) && dayData && typeof dayData === 'object') { // Match "YYYY-MM"
                const zoneData = (dayData as Record<string, HistoricalZoneData>)[zone];
                if (zoneData && zoneData.cabinetFailureLuminaireIds) {
                     const date = parse(dateStr, 'yyyy-MM-dd', new Date());
                     zoneData.cabinetFailureLuminaireIds.forEach(id => {
                        const luminaireInfo = luminaireIdToInfoMap.get(id);
                        failures.push({
                            date,
                            id,
                            zone: zone,
                            municipio: luminaireInfo?.municipio || 'Desconocido (No en Inventario)',
                        });
                     });
                }
            }
        });
        return failures;
    }, [dataForUser.historicalData, currentAppState.selectedHistoricalMonthZone, luminaireIdToInfoMap]);

    const cabinetFailureAnalysis = useMemo(() => {
        const zoneFilter = currentAppState.selectedZone;
    
        const relevantInventory = zoneFilter === 'all'
            ? dataForUser.inventory
            : dataForUser.inventory.filter(item => item.zone === zoneFilter);
        
        const relevantEvents = zoneFilter === 'all'
            ? dataForUser.allEvents
            : dataForUser.allEvents.filter(e => e.zone === zoneFilter);

        const inventoryWithAccounts = relevantInventory.filter(item => item.nroCuenta && item.nroCuenta.trim() !== '' && item.nroCuenta.trim() !== '-');
        const luminairesByAccount = inventoryWithAccounts.reduce((acc, item) => {
            const account = item.nroCuenta!;
            if (!acc[account]) {
                acc[account] = { total: 0, zone: item.zone };
            }
            acc[account].total++;
            return acc;
        }, {} as Record<string, { total: number, zone: string }>);
    
        const inaccessibleEvents = relevantEvents.filter(e => e.failureCategory === 'Inaccesible');
        const luminaireIdToAccountMap = new Map<string, string>();
        inventoryWithAccounts.forEach(item => {
            if(item.streetlightIdExterno && item.nroCuenta) {
                luminaireIdToAccountMap.set(item.streetlightIdExterno, item.nroCuenta);
            }
        });
        
        const inaccessibleUniqueLuminairesByAccount: Record<string, Set<string>> = {};
        inaccessibleEvents.forEach(event => {
            const account = luminaireIdToAccountMap.get(event.id);
            if (account) {
                if (!inaccessibleUniqueLuminairesByAccount[account]) {
                    inaccessibleUniqueLuminairesByAccount[account] = new Set<string>();
                }
                inaccessibleUniqueLuminairesByAccount[account].add(event.id);
            }
        });
    
        const failedCabinets: { nroCuenta: string; zone: string; }[] = [];
        Object.keys(luminairesByAccount).forEach(nroCuenta => {
            const data = luminairesByAccount[nroCuenta];
            const totalLuminaires = data.total;
            const inaccessibleCount = inaccessibleUniqueLuminairesByAccount[nroCuenta]?.size || 0;
            if (totalLuminaires > 0) {
                const percentage = (inaccessibleCount / totalLuminaires) * 100;
                if (percentage > 90) {
                    failedCabinets.push({ nroCuenta, zone: data.zone });
                }
            }
        });
    
        const summaryByZone = failedCabinets.reduce((acc, cabinet) => {
            if (!acc[cabinet.zone]) {
                acc[cabinet.zone] = { count: 0, accounts: [] };
            }
            acc[cabinet.zone].count++;
            acc[cabinet.zone].accounts.push(cabinet.nroCuenta);
            return acc;
        }, {} as Record<string, { count: number; accounts: string[] }>);
    
        const summaryTableData = Object.entries(summaryByZone).map(([zone, data]) => ({
            name: zone,
            count: data.count,
            accounts: data.accounts
        })).sort((a, b) => {
            const iA = ZONE_ORDER.indexOf(a.name);
            const iB = ZONE_ORDER.indexOf(b.name);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1;
            if (iB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
    
        return { summaryTableData };
    
    }, [dataForUser.allEvents, dataForUser.inventory, currentAppState.selectedZone]);

    // --- New calculations for CambiosTab ---
    const changesByMonthData = useMemo(() => {
        if (!currentAppState.selectedChangesYear) return { data: [] };

        const yearData = dataForUser.changeEvents.filter(e => format(e.fechaRetiro, 'yyyy') === currentAppState.selectedChangesYear);
        
        const counts = yearData.reduce((acc, event) => {
            const monthName = format(event.fechaRetiro, 'MMMM', { locale: es });
            const monthKey = format(event.fechaRetiro, 'yyyy-MM');
            if (!acc[monthKey]) {
                acc[monthKey] = { name: monthName, LUMINARIA: 0, OLC: 0, date: event.fechaRetiro };
            }
            const component = event.componente.toUpperCase();
            if (component.includes('LUMINARIA')) {
                acc[monthKey].LUMINARIA++;
            } else if (component.includes('OLC')) {
                acc[monthKey].OLC++;
            }
            return acc;
        }, {} as Record<string, { name: string; LUMINARIA: number; OLC: number, date: Date }>);

        const sortedData = Object.values(counts).sort((a, b) => a.date.getTime() - b.date.getTime());
        
        return { data: sortedData };
    }, [dataForUser.changeEvents, currentAppState.selectedChangesYear]);

    const historicalChangesByCondition = useMemo(() => {
        const countsByYear: Record<string, {
            garantiaLuminaria: number; garantiaOlc: number;
            columnaCaidaLuminaria: number; columnaCaidaOlc: number;
            hurtoLuminaria: number; hurtoOlc: number;
            vandalizadoLuminaria: number; vandalizadoOlc: number;
        }> = {};

        dataForUser.changeEvents.forEach(event => {
            const year = format(event.fechaRetiro, 'yyyy');
            if (!countsByYear[year]) {
                countsByYear[year] = {
                    garantiaLuminaria: 0, garantiaOlc: 0,
                    columnaCaidaLuminaria: 0, columnaCaidaOlc: 0,
                    hurtoLuminaria: 0, hurtoOlc: 0,
                    vandalizadoLuminaria: 0, vandalizadoOlc: 0,
                };
            }

            const component = event.componente.toUpperCase();
            const condicion = event.condicion.toLowerCase();

            if (condicion === 'garantia') {
                if (component.includes('LUMINARIA')) countsByYear[year].garantiaLuminaria++;
                else if (component.includes('OLC')) countsByYear[year].garantiaOlc++;
            } else if (condicion === 'columna caída') {
                if (component.includes('LUMINARIA')) countsByYear[year].columnaCaidaLuminaria++;
                else if (component.includes('OLC')) countsByYear[year].columnaCaidaOlc++;
            } else if (condicion === 'hurto') {
                if (component.includes('LUMINARIA')) countsByYear[year].hurtoLuminaria++;
                else if (component.includes('OLC')) countsByYear[year].hurtoOlc++;
            } else if (condicion === 'vandalizado') {
                if (component.includes('LUMINARIA')) countsByYear[year].vandalizadoLuminaria++;
                else if (component.includes('OLC')) countsByYear[year].vandalizadoOlc++;
            }
        });
        
        return Object.entries(countsByYear)
            .map(([year, data]) => ({ year, ...data }))
            .sort((a, b) => parseInt(b.year) - parseInt(a.year));
    }, [dataForUser.changeEvents]);


    // --- Map Modal Handlers ---
    const handleOpenMapModal = useCallback((zoneName: string) => {
        const zoneFailureData = cabinetFailureAnalysis.summaryTableData.find(d => d.name === zoneName);
        if (!zoneFailureData) return;
        const failedAccounts = new Set(zoneFailureData.accounts);
        const pointsForMap = dataForUser.servicePoints.filter(sp => failedAccounts.has(sp.nroCuenta));

        setMapModalData({
            title: `Mapa de Tableros con Falla - ${zoneName}`,
            servicePoints: pointsForMap,
        });
        setIsMapModalOpen(true);
    }, [cabinetFailureAnalysis.summaryTableData, dataForUser.servicePoints]);

    const handleCloseMapModal = useCallback(() => setIsMapModalOpen(false), []);


    // --- Export Handlers ---
    const generateExportFilename = useCallback((baseName: string): string => { const dateStr = new Date().toISOString().split('T')[0]; const zoneStr = currentAppState.selectedZone !== 'all' ? `_${currentAppState.selectedZone.replace(/\s+/g, '_')}` : ''; const municipioStr = currentAppState.selectedMunicipio !== 'all' ? `_${currentAppState.selectedMunicipio.replace(/\s+/g, '_')}` : ''; return `${baseName}${zoneStr}${municipioStr}_${dateStr}.xlsx`; }, [currentAppState.selectedZone, currentAppState.selectedMunicipio]);
    
    const handleExportCabinetFailureAnalysis = useCallback(() => {
        const { summaryTableData } = cabinetFailureAnalysis;
        if (summaryTableData.length === 0) return;

        const summarySheetData = summaryTableData.map(item => ({
            'Zona': item.name,
            'Tableros con Falla': item.count,
        }));

        const detailSheetData = summaryTableData.flatMap(zoneData => 
            zoneData.accounts.map(account => ({
                'Zona': zoneData.name,
                'Nro. de Cuenta con Falla': account
            }))
        );

        exportToXlsxMultiSheet(
            [
                { sheetName: 'Resumen por Zona', data: summarySheetData },
                { sheetName: 'Detalle Cuentas', data: detailSheetData },
            ],
            generateExportFilename('analisis_tableros_falla')
        );
    }, [cabinetFailureAnalysis, generateExportFilename]);

    const handleExportCabinetSummary = useCallback(() => { exportToXlsx(cabinetSummaryData, generateExportFilename('resumen_gabinetes')); }, [cabinetSummaryData, generateExportFilename]);
    const handleExportServiceSummary = useCallback(() => { exportToXlsx(serviceSummaryData, generateExportFilename('resumen_servicios')); }, [serviceSummaryData, generateExportFilename]);
    const handleExportPowerSummary = useCallback(() => { const { powerData, locationColumns, columnTotals, grandTotal } = powerSummary; if (powerData.length === 0) return; const exportData = powerData.map((row: { power: string; total: number;[key: string]: any }) => { const flatRow: Record<string, any> = { Potencia: row.power }; locationColumns.forEach(loc => { flatRow[loc] = (row as any)[loc] || 0; }); flatRow['Total'] = row.total; return flatRow; }); const totalsRow: Record<string, any> = { Potencia: 'Total General' }; locationColumns.forEach(loc => { totalsRow[loc] = columnTotals[loc] || 0; }); totalsRow['Total'] = grandTotal; exportData.push(totalsRow); exportToXlsx(exportData, generateExportFilename('resumen_potencias')); }, [powerSummary, generateExportFilename]);
    const handleExportFailureByZone = useCallback(() => { const { data: dataToExport, categories } = failureDataByZone; if (dataToExport.length === 0) return; const dataForSheet = dataToExport.map(item => { const row: Record<string, any> = { 'Zona': item.name, 'Porcentaje Fallas (%)': item.porcentaje.toFixed(2), 'Total Fallas': item.eventos, 'Total Inventario': item.totalInventario }; categories.forEach(cat => { row[cat] = item[cat] || 0; }); return row; }); exportToXlsx(dataForSheet, generateExportFilename('fallas_por_zona')); }, [failureDataByZone, generateExportFilename]);
    const handleExportFailureByMunicipio = useCallback(() => { const { data: dataToExport, categories } = failureDataByMunicipio; if (dataToExport.length === 0) return; const dataForSheet = dataToExport.map(item => { const row: Record<string, any> = { 'Municipio': item.name, 'Porcentaje Fallas (%)': item.porcentaje.toFixed(2), 'Total Fallas': item.eventos, 'Total Inventario': item.totalInventario }; categories.forEach(cat => { row[cat] = item[cat] || 0; }); return row; }); exportToXlsx(dataForSheet, generateExportFilename('fallas_por_municipio')); }, [failureDataByMunicipio, generateExportFilename]);
    const handleExportChangesByMunicipio = useCallback(() => { exportToXlsx(changesByMunicipioData, generateExportFilename('cambios_por_municipio')); }, [changesByMunicipioData, generateExportFilename]);
    const handleExportFilteredEvents = useCallback(() => {
        if (displayEvents.length === 0) return;
        const dataForExport = displayEvents.map(event => ({
            'Fecha': event.date.toLocaleString('es-ES'),
            'ID Luminaria': event.id,
            'Dirección Hardware OLC': event.olcHardwareDir,
            'Municipio': event.municipio,
            'Zona': event.zone,
            'Estado': event.status,
            'Categoría de Falla': event.failureCategory,
            'Descripción': event.description,
            'Potencia (W)': event.power,
            'Potencia Medida (W)': event.systemMeasuredPower?.toFixed(2) ?? 'N/A',
            'Latitud': event.lat,
            'Longitud': event.lon,
        }));
        const filename = generateExportFilename(`eventos_${currentAppState.cardFilter?.replace(/\s+/g, '_') || 'filtrados'}`);
        exportToXlsx(dataForExport, filename);
    }, [displayEvents, currentAppState.cardFilter, generateExportFilename]);
    const handleExportOperatingHoursSummary = useCallback(() => { if (operatingHoursSummary.length === 0) return; const getRangeStart = (rangeStr: string): number => { if (rangeStr.startsWith('>')) return Infinity; return parseInt(rangeStr.split(' ')[0].replace(/\D/g, ''), 10); }; const dataToExport = [...operatingHoursSummary].sort((a, b) => getRangeStart(a.range) - getRangeStart(b.range)).map(item => { const row: Record<string, any> = { 'Rango de Horas': item.range, 'Total Luminarias': item.total }; operatingHoursZones.forEach(zone => { row[zone] = item[zone] || 0; }); return row; }); exportToXlsx(dataToExport, generateExportFilename('resumen_horas_funcionamiento')); }, [operatingHoursSummary, operatingHoursZones, generateExportFilename]);
    const handleExportOperatingHoursDetail = useCallback(() => { if (operatingHoursDetailData.length === 0 || !currentAppState.selectedOperatingHoursRange) return; const filename = generateExportFilename(`detalle_luminarias_rango_${currentAppState.selectedOperatingHoursRange.replace(/[^\w]/g, '_')}`); const dataForExport = operatingHoursDetailData.map(item => ({ 'ID de luminaria': item.streetlightIdExterno, 'Dirección Hardware OLC': item.olcHardwareDir ?? 'N/A', 'Municipio': item.municipio, 'Latitud': item.lat ?? 'N/A', 'Longitud': item.lon ?? 'N/A' })); exportToXlsx(dataForExport, filename); }, [operatingHoursDetailData, currentAppState.selectedOperatingHoursRange, generateExportFilename]);

    const handleExportHistoricalSummary = useCallback(() => {
        if (!filteredHistoricalData || Object.keys(filteredHistoricalData).length === 0) return;
    
        // FIX: Replaced a complex/problematic Omit<> type with an explicit type for monthly summaries to improve type safety.
        type MonthlySummary = {
            eventos: { total: number, count: number };
            porcentaje: { total: number, count: number };
            eventosGabinete: { total: number, count: number };
            porcentajeGabinete: { total: number, count: number };
            eventosVandalismo: { total: number, count: number };
            porcentajeVandalismo: { total: number, count: number };
            eventosReales: { total: number, count: number };
            porcentajeReal: { total: number, count: number };
        };
        const monthlySummaries: Record<string, Record<string, MonthlySummary>> = {};
        const presentZones = new Set<string>();
    
        Object.entries(filteredHistoricalData).forEach(([dateStr, zonesData]) => {
            if (!zonesData || typeof zonesData !== 'object') return;
            const monthKey = format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'yyyy-MM');
            if (!monthlySummaries[monthKey]) monthlySummaries[monthKey] = {};
    
            Object.entries(zonesData).forEach(([zoneName, zoneData]) => {
                presentZones.add(zoneName);
                if (!monthlySummaries[monthKey][zoneName]) {
                    // FIX: Initialize object matching the explicit type above.
                    monthlySummaries[monthKey][zoneName] = {
                        eventos: { total: 0, count: 0 },
                        porcentaje: { total: 0, count: 0 },
                        eventosGabinete: { total: 0, count: 0 },
                        porcentajeGabinete: { total: 0, count: 0 },
                        eventosVandalismo: { total: 0, count: 0 },
                        porcentajeVandalismo: { total: 0, count: 0 },
                        eventosReales: { total: 0, count: 0 },
                        porcentajeReal: { total: 0, count: 0 },
                    };
                }
    
                const summary = monthlySummaries[monthKey][zoneName];
                // FIX: Accessing properties is now type-safe.
                summary.eventos.total += zoneData.eventos;
                summary.porcentaje.total += zoneData.porcentaje;
                summary.eventosGabinete.total += zoneData.eventosGabinete;
                summary.porcentajeGabinete.total += zoneData.porcentajeGabinete;
                summary.eventosVandalismo.total += zoneData.eventosVandalismo;
                summary.porcentajeVandalismo.total += zoneData.porcentajeVandalismo;
                summary.eventosReales.total += zoneData.eventosReales;
                summary.porcentajeReal.total += zoneData.porcentajeReal;
                summary.porcentaje.count++; // Use one count for all percentages as they are daily
            });
        });
    
        const sortedZones = Array.from(presentZones).sort((a, b) => { const iA = ZONE_ORDER.indexOf(a); const iB = ZONE_ORDER.indexOf(b); if (iA !== -1 && iB !== -1) return iA - iB; if (iA !== -1) return -1; if (iB !== -1) return 1; return a.localeCompare(b); });
    
        const processData = (
            dataType: 'percentage' | 'count'
        ) => {
            // FIX: Add explicit return type to map callback to ensure correct type inference for sort.
            const mappedData = Object.entries(monthlySummaries).map(([, zoneAvgs]): { date: Date; [key: string]: any } => {
                const monthKey = Object.keys(monthlySummaries).find(key => monthlySummaries[key] === zoneAvgs)!;
                const row: Record<string, any> = { 'Mes': format(parse(monthKey, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es }) };
                sortedZones.forEach(zone => {
                    const data = zoneAvgs[zone];
                    if (dataType === 'percentage') {
                        // FIX: Accessing properties is now type-safe.
                        const avg = data && data.porcentaje.count > 0 ? (data.porcentajeReal.total / data.porcentaje.count).toFixed(2) + '%' : '0.00%';
                        row[`${zone} (% Falla Real)`] = avg;
                    } else {
                        // FIX: Accessing properties is now type-safe.
                        row[`${zone} (Cant. Eventos)`] = data ? data.eventos.total : 0;
                    }
                });
                return { ...row, date: parse(monthKey, 'yyyy-MM', new Date()) };
            });

            // FIX: Added explicit types to sort callback parameters to resolve "'date' does not exist on type 'unknown'" error due to type inference limitations.
            return mappedData.sort((a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime()).map(({ date, ...rest }) => rest);
        };
    
        // FIX: Add explicit return type to map callback to ensure correct type inference for sort.
        const percentageData = Object.entries(monthlySummaries).map(([monthKey, zoneSummaries]): { rows: any[], date: Date } => {
            const rowsForMonth: any[] = [];
            sortedZones.forEach(zone => {
                const summary = zoneSummaries[zone];
                // FIX: Accessing properties is now type-safe.
                const count = summary ? summary.porcentaje.count : 0;
                rowsForMonth.push({
                    'Mes': format(parse(monthKey, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es }),
                    'Zona': zone,
                    // FIX: Accessing properties is now type-safe.
                    '% Falla Total': summary && count > 0 ? `${(summary.porcentaje.total / count).toFixed(2)}%` : '0.00%',
                    '% Falla Gabinete': summary && count > 0 ? `${(summary.porcentajeGabinete.total / count).toFixed(2)}%` : '0.00%',
                    '% Falla Vandalismo': summary && count > 0 ? `${(summary.porcentajeVandalismo.total / count).toFixed(2)}%` : '0.00%',
                    '% Falla Real': summary && count > 0 ? `${(summary.porcentajeReal.total / count).toFixed(2)}%` : '0.00%',
                });
            });
            return { rows: rowsForMonth, date: parse(monthKey, 'yyyy-MM', new Date()) };
        // FIX: Added explicit types to sort callback parameters to resolve "'date' does not exist on type 'unknown'" error due to type inference limitations.
        }).sort((a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime()).flatMap(item => item.rows);


        const countsData = processData('count');
    
        exportToXlsxMultiSheet(
            [
                { sheetName: 'Desglose Porcentajes', data: percentageData },
                { sheetName: 'Cantidad Eventos', data: countsData }
            ],
            'resumen_historico.xlsx'
        );
    
    }, [filteredHistoricalData]);


    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-200">
                <p>Cargando autenticación...</p>
            </div>
        );
    }
    
    if (!user) {
        return <AuthPage />;
    }

    if (!userProfile || userProfile.accessStatus !== 'approved') {
         const message = userProfile?.accessStatus === 'rejected' 
            ? 'Su acceso ha sido denegado. Por favor, contacte a un administrador.'
            : 'Su cuenta ha sido creada exitosamente. Un administrador debe aprobar su acceso y asignarle un rol para poder ingresar al sistema.';

        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-gray-200 p-4">
                <h2 className="text-2xl font-semibold text-cyan-400 mb-4">Acceso Pendiente o Denegado</h2>
                <p className="text-center text-gray-400 max-w-lg mb-6">
                   {message}
                </p>
                <button 
                    onClick={() => signOut(auth)}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
                >
                    Cerrar Sesión
                </button>
            </div>
        );
    }
    
    if (portalTab) {
        // Portal-specific rendering logic
        const loading = dataLoading;
        const error = dataError;

        if (loading) {
            return <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-200">Cargando datos...</div>;
        }
        if (error) {
             return (
                <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-gray-200 p-4">
                    <h2 className="text-xl font-semibold text-red-400">Error en Ventana Secundaria</h2>
                    <p className="text-center text-gray-400 mt-2 max-w-lg">{error}</p>
                </div>
            );
        }
        if (!portalState) {
            return <div className="flex items-center justify-center h-screen bg-gray-900 text-gray-200">Sincronizando estado con ventana principal...</div>;
        }

        const portalTitles: Record<ActiveTab, string> = {
            'inventario': 'Inventario',
            'cambios': 'Cambios',
            'eventos': 'Eventos',
            'historial': 'Historial de Eventos',
            'mantenimiento': 'Generador de Hojas de Ruta',
            'admin': 'Administración',
        };

        const tabProps = {
            // Eventos Props
            baseFilteredEvents, displayEvents, oldestEventsByZone, failureDataByZone, failureDataByMunicipio,
            inaccesibleFailures, lowCurrentFailures, highCurrentFailures, voltageFailures, columnaCaidaFailures, hurtoFailures, vandalizadoFailures,
            cardFilter: currentAppState.cardFilter, 
            cabinetFailureAnalysisData: cabinetFailureAnalysis.summaryTableData,
            selectedZoneForCabinetDetails: currentAppState.selectedZoneForCabinetDetails,
            handleCabinetZoneRowClick: () => {}, handleCardClick: () => {}, handleExportFailureByZone: () => {}, handleExportFailureByMunicipio: () => {}, handleExportFilteredEvents: () => {},
            handleExportCabinetFailureAnalysis: () => {},
            servicePoints: dataForUser.servicePoints, handleOpenMapModal: () => {},
            // Cambios Props
            baseFilteredChangeEvents, displayChangeEvents, changesByMunicipioData,
            luminariaChangesCount, olcChangesCount, garantiaChangesCount, vandalizadoChangesCount, columnaCaidaChangesCount, hurtoChangesCount,
            cardChangeFilter: currentAppState.cardChangeFilter, searchTerm: currentAppState.searchTerm,
            handleCardChangeClick: () => {}, handleExportChangesByMunicipio: () => {},
            availableYears, selectedChangesYear: currentAppState.selectedChangesYear, setSelectedChangesYear: () => {}, changesByMonthData, historicalChangesByCondition,
            // Inventario Props
            displayInventory, finalDisplayInventory, powerSummary, operatingHoursSummary, operatingHoursZones, operatingHoursDetailData, cabinetSummaryData, serviceSummaryData,
            uniqueCabinetCount, inauguratedCount, markedCount, uniqueAccountCount, vandalizadoInventoryCount, hurtoInventoryCount, columnaCaidaInventoryCount, faltaPodaInventoryCount, faltaLineaInventoryCount,
            selectedZone: currentAppState.selectedZone, isInventorySummariesOpen: currentAppState.isInventorySummariesOpen, selectedOperatingHoursRange: currentAppState.selectedOperatingHoursRange, cardInventoryFilter: currentAppState.cardInventoryFilter,
            handleCardInventoryClick: () => {}, handleExportPowerSummary: () => {}, handleExportOperatingHoursSummary: () => {}, handleExportOperatingHoursDetail: () => {},
            setIsInventorySummariesOpen: () => {}, handleExportCabinetSummary: () => {}, handleExportServiceSummary: () => {}, handleOperatingHoursRowClick: () => {},
             // Historial Props
            historicalData: filteredHistoricalData,
            uniqueFailuresInDateRange,
            uniqueFailuresByZoneInDateRange,
            cabinetFailuresInDateRange,
            cabinetFailuresForSelectedMonth,
            dateRange: currentAppState.dateRange,
            selectedHistoricalMonthZone: currentAppState.selectedHistoricalMonthZone,
            setSelectedHistoricalMonthZone: () => {},
            // Mantenimiento Props
            allEvents: dataForUser.allEvents,
            inventory: dataForUser.inventory,
            zoneBases: dataForUser.zoneBases,
            zones: zones,
            // Admin Props
            allZones: zones.length > 0 ? zones : ALL_ZONES,
        };

        const renderTabContent = () => {
            switch (portalTab) {
                case 'eventos': return <EventosTab {...tabProps} />;
                case 'cambios': return <CambiosTab {...tabProps} setSearchTerm={undefined} />;
                case 'inventario': return <InventarioTab {...tabProps} />;
                case 'historial': return <HistorialTab {...tabProps} />;
                case 'mantenimiento': return <MantenimientoTab {...tabProps} cabinetFailureAnalysisData={cabinetFailureAnalysis.summaryTableData} servicePoints={servicePoints} />;
                case 'admin': return <AdminTab {...tabProps} />;
                default: return <div>Tab no encontrado</div>;
            }
        };

        return (
            <div className="bg-gray-900 text-gray-200 font-sans p-4 h-screen overflow-y-auto">
                 <h1 className="text-2xl font-bold text-cyan-400 mb-2">
                    Ventana: {portalTitles[portalTab] ?? (portalTab.charAt(0).toUpperCase() + portalTab.slice(1))}
                </h1>
                <p className="text-sm text-gray-400 mb-4">
                    Datos al {currentAppState.latestDataDate ? format(currentAppState.latestDataDate, 'dd/MM/yyyy') : 'N/A'}. Los filtros se controlan desde la ventana principal.
                </p>
                {renderTabContent()}
            </div>
        );
    }
    
    // --- MAIN APP RENDER ---
    const noDataLoaded = !dataLoading && dataForUser.allEvents.length === 0 && dataForUser.changeEvents.length === 0 && dataForUser.inventory.length === 0;
    const loading = dataLoading;
    const error = dataError;

    return (
        <div className="flex flex-col h-screen bg-gray-900 text-gray-200 font-sans">
            <Header
                latestDataDate={latestDataDate}
                userProfile={userProfile}
            />
            <main className="flex-grow container mx-auto px-4 md:px-8 pt-4 overflow-hidden flex flex-col">
                <div className="flex-shrink-0">
                    {isFiltersVisible && (
                         <div id="filters-panel" className="bg-gray-800 shadow-lg rounded-xl p-4 mb-4">
                            <FilterControls
                                activeTab={activeTab} userProfile={userProfile} dateRange={dateRange} setDateRange={setDateRange} handleSetDatePreset={handleSetDatePreset}
                                selectedZone={selectedZone} setSelectedZone={setSelectedZone} selectedMunicipio={selectedMunicipio}
                                setSelectedMunicipio={setSelectedMunicipio} municipios={filteredMunicipios} selectedCategory={selectedCategory}
                                setSelectedCategory={setSelectedCategory} zones={zones.length > 0 ? zones : ALL_ZONES} failureCategories={failureCategories}
                                availableYears={availableYears} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
                                selectedYear={selectedYear} setSelectedYear={setSelectedYear} availablePowers={availablePowers}
                                selectedPower={selectedPower} setSelectedPower={setSelectedPower} availableCalendars={availableCalendars}
                                selectedCalendar={selectedCalendar} setSelectedCalendar={setSelectedCalendar}
                            />
                        </div>
                    )}

                    <div className="border-b border-gray-700 flex justify-between items-center">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                             <TabButton tabId="inventario" title="Inventario" activeTab={activeTab} setActiveTab={setActiveTab} disabled={dataForUser.inventory.length === 0} onPopOut={handlePopOut} />
                             <TabButton tabId="cambios" title="Cambios" activeTab={activeTab} setActiveTab={setActiveTab} disabled={dataForUser.changeEvents.length === 0} onPopOut={handlePopOut} />
                             <TabButton tabId="eventos" title="Eventos" activeTab={activeTab} setActiveTab={setActiveTab} disabled={dataForUser.allEvents.length === 0} onPopOut={handlePopOut} />
                             <TabButton tabId="historial" title="Historial de Eventos" activeTab={activeTab} setActiveTab={setActiveTab} disabled={Object.keys(dataForUser.historicalData).length === 0} onPopOut={handlePopOut} />
                             <TabButton tabId="mantenimiento" title="Mantenimiento" activeTab={activeTab} setActiveTab={setActiveTab} disabled={dataForUser.allEvents.length === 0 || dataForUser.inventory.length === 0} onPopOut={handlePopOut} />
                             {userProfile?.role === 'administrador' && (
                                <TabButton tabId="admin" title="Administración" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={handlePopOut} />
                             )}
                        </nav>
                        <button
                            onClick={() => setIsFiltersVisible(v => !v)}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                                isFiltersVisible
                                    ? 'bg-cyan-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                            aria-pressed={isFiltersVisible}
                            aria-controls="filters-panel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                            </svg>
                            Filtros
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto pt-4">
                    {loading && <div className="text-center p-8"><p>Cargando datos desde la nube...</p></div>}
                    {error && (
                        <div className="text-center p-16 bg-gray-800 rounded-lg">
                            <h2 className="text-2xl font-semibold text-red-400">Error al Cargar Datos</h2>
                            <p className="text-gray-400 mt-2 max-w-2xl mx-auto">{error}</p>
                        </div>
                    )}
                    
                    {!loading && !error && (
                        <>
                           {noDataLoaded && activeTab !== 'admin' && (
                                <div className="text-center p-16 bg-gray-800 rounded-lg">
                                    <h2 className="text-2xl font-semibold text-gray-300">
                                       No hay datos para mostrar
                                    </h2>
                                    <p className="text-gray-500 mt-2">
                                       No se encontró información en las fuentes de datos configuradas en Firebase para su zona.
                                    </p>
                                </div>
                            )}

                           {activeTab === 'eventos' && dataForUser.allEvents.length > 0 && (
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
                                        cabinetFailureAnalysisData={cabinetFailureAnalysis.summaryTableData}
                                        selectedZoneForCabinetDetails={selectedZoneForCabinetDetails}
                                        handleCabinetZoneRowClick={handleCabinetZoneRowClick}
                                        handleCardClick={handleCardClick}
                                        handleExportFailureByZone={handleExportFailureByZone}
                                        handleExportFailureByMunicipio={handleExportFailureByMunicipio}
                                        handleExportFilteredEvents={handleExportFilteredEvents}
                                        handleExportCabinetFailureAnalysis={handleExportCabinetFailureAnalysis}
                                        servicePoints={dataForUser.servicePoints}
                                        handleOpenMapModal={handleOpenMapModal}
                                    />
                                )
                           )}
                           {activeTab === 'cambios' && dataForUser.changeEvents.length > 0 && (
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
                                        availableYears={availableYears}
                                        selectedChangesYear={selectedChangesYear}
                                        setSelectedChangesYear={setSelectedChangesYear}
                                        changesByMonthData={changesByMonthData}
                                        historicalChangesByCondition={historicalChangesByCondition}
                                    />
                                )
                           )}
                           {activeTab === 'inventario' && dataForUser.inventory.length > 0 && (
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
                            {activeTab === 'historial' && Object.keys(dataForUser.historicalData).length > 0 && (
                                poppedOutTabs.includes('historial') ? (
                                    <div className="text-center p-16 bg-gray-800 rounded-lg">
                                        <h2 className="text-2xl font-semibold text-gray-300">Pestaña Activa en Otra Ventana</h2>
                                        <p className="text-gray-500 mt-2">
                                            El contenido de la pestaña "Historial" se está mostrando en una ventana separada.
                                            Cierre esa ventana para volver a ver el contenido aquí.
                                        </p>
                                    </div>
                                ) : (
                                    <HistorialTab
                                        historicalData={filteredHistoricalData}
                                        uniqueFailuresInDateRange={uniqueFailuresInDateRange}
                                        uniqueFailuresByZoneInDateRange={uniqueFailuresByZoneInDateRange}
                                        cabinetFailuresInDateRange={cabinetFailuresInDateRange}
                                        cabinetFailuresForSelectedMonth={cabinetFailuresForSelectedMonth}
                                        dateRange={dateRange}
                                        handleExportHistoricalSummary={handleExportHistoricalSummary}
                                        selectedHistoricalMonthZone={selectedHistoricalMonthZone}
                                        setSelectedHistoricalMonthZone={setSelectedHistoricalMonthZone}
                                    />
                                )
                           )}
                           {activeTab === 'mantenimiento' && (dataForUser.allEvents.length > 0 && dataForUser.inventory.length > 0) && (
                                poppedOutTabs.includes('mantenimiento') ? (
                                    <div className="text-center p-16 bg-gray-800 rounded-lg">
                                        <h2 className="text-2xl font-semibold text-gray-300">Pestaña Activa en Otra Ventana</h2>
                                        <p className="text-gray-500 mt-2">
                                            El contenido de la pestaña "Mantenimiento" se está mostrando en una ventana separada.
                                            Cierre esa ventana para volver a ver el contenido aquí.
                                        </p>
                                    </div>
                                ) : (
                                    <MantenimientoTab
                                        allEvents={dataForUser.allEvents}
                                        inventory={dataForUser.inventory}
                                        servicePoints={dataForUser.servicePoints}
                                        zoneBases={dataForUser.zoneBases}
                                        zones={zones}
                                        cabinetFailureAnalysisData={cabinetFailureAnalysis.summaryTableData}
                                    />
                                )
                           )}
                            {activeTab === 'admin' && userProfile?.role === 'administrador' && (
                                <AdminTab allZones={zones.length > 0 ? zones : ALL_ZONES} />
                           )}
                        </>
                    )}
                </div>
            </main>
            <MapModal 
                isOpen={isMapModalOpen}
                onClose={handleCloseMapModal}
                title={mapModalData.title}
                servicePoints={mapModalData.servicePoints}
            />
        </div>
    );
};

export default App;