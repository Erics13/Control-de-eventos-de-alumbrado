
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import es from 'date-fns/locale/es'; // FIX: Changed to default import
// FIX: Corrected date-fns imports to use named imports from their specific subpaths.
import { startOfDay } from 'date-fns/startOfDay';
import { endOfDay } from 'date-fns/endOfDay';
import { subDays } from 'date-fns/subDays';
import { startOfMonth } from 'date-fns/startOfMonth';
import { endOfMonth } from 'date-fns/endOfMonth';
import { startOfYear } from 'date-fns/startOfYear';
import { endOfYear } from 'date-fns/endOfYear';

import Header from './components/Header';
import { FilterControls } from './components/FilterControls';
import AuthPage from './components/AuthPage';
import TabButton from './components/TabButton';

import EventosTab from './components/EventosTab';
import CambiosTab from './components/CambiosTab';
import InventarioTab from './components/InventarioTab';
import HistorialTab from './components/HistorialTab';
import RutasTab from './components/RutasTab';
import AdminTab from './components/AdminTab';

import { useAuth } from './hooks/useAuth';
import { useLuminaireData } from './hooks/useLuminaireData';
import { exportToXlsx, exportToXlsxMultiSheet } from './utils/export';
import { ALL_ZONES, ZONE_ORDER, ALCID_TO_MUNICIPIO_MAP, OPERATING_HOURS_RANGES, meses } from './constants';
import { normalizeString } from './utils/string'; 
import type { 
    ActiveTab, HistoricalData, HistoricalZoneData, InventoryItem, LuminaireEvent, ChangeEvent, CabinetFailureDetail,
    PowerSummaryData, OperatingHoursSummary, CabinetSummary, ServiceSummary, MonthlyChangesSummary, HistoricalChangesByConditionSummary,
    ServicePoint, PowerSummaryTableData
} from './types';

const App: React.FC = () => {
    // Auth
    const { user, userProfile, loading: authLoading } = useAuth();
    
    // Data
    const { 
        allEvents, changeEvents, inventory, servicePoints, zoneBases, historicalData, 
        loading: dataLoading, error: dataError 
    } = useLuminaireData();

    // UI State
    const [activeTab, setActiveTab] = useState<ActiveTab>('inventario'); // Initial tab set to Inventario
    const [isInventorySummariesOpen, setIsInventorySummariesOpen] = useState(false);
    
    // Filters State
    const [dateRange, setDateRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [selectedZone, setSelectedZone] = useState('all');
    const [selectedMunicipio, setSelectedMunicipio] = useState('all');
    
    // Event Filters
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cardFilter, setCardFilter] = useState<string | null>(null);
    const [selectedZoneForCabinetDetails, setSelectedZoneForCabinetDetails] = useState<string | null>(null);

    // Inventory Filters
    const [selectedPower, setSelectedPower] = useState('all');
    const [selectedCalendar, setSelectedCalendar] = useState('all');
    const [cardInventoryFilter, setCardInventoryFilter] = useState<{ key: keyof InventoryItem; value: string } | null>(null);
    const [selectedOperatingHoursRange, setSelectedOperatingHoursRange] = useState<string | null>(null);

    // Change Filters
    const [selectedChangesYear, setSelectedChangesYear] = useState<string>(new Date().getFullYear().toString());
    const [cardChangeFilter, setCardChangeFilter] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Historical Filters
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedHistoricalMonthZone, setSelectedHistoricalMonthZone] = useState<{ month: string, zone: string } | null>(null);

    // --- Helpers ---
    const zones = ALL_ZONES;
    const municipios = useMemo(() => Array.from(new Set(inventory.map(i => i.municipio).filter(Boolean))).sort(), [inventory]);
    const failureCategories = useMemo(() => Array.from(new Set(allEvents.map(e => e.failureCategory).filter(c => c && c !== 'N/A'))).sort(), [allEvents]);
    const availablePowers = useMemo(() => Array.from(new Set(inventory.map(i => i.potenciaNominal?.toString()).filter((p): p is string => !!p))).sort((a: string,b: string) => parseInt(a) - parseInt(b)), [inventory]);
    const availableCalendars = useMemo(() => Array.from(new Set(inventory.map(i => i.dimmingCalendar).filter(Boolean))).sort(), [inventory]);
    
    const allYearsFromData = useMemo(() => {
        const years = new Set<string>();
        Object.keys(historicalData).forEach((dateKey: string) => years.add(dateKey.split('-')[0]));
        changeEvents.forEach(e => years.add(e.fechaRetiro.getFullYear().toString()));
        return Array.from(years).sort((a: string, b: string) => parseInt(b) - parseInt(a)); // Sort descending
    }, [historicalData, changeEvents]);
    const availableYears = allYearsFromData.length > 0 ? allYearsFromData : [new Date().getFullYear().toString()];


    // --- Data Maps (crucial for linking data efficiently) ---
    const inventoryMap = useMemo(() => {
        return new Map<string, InventoryItem>(inventory.map(item => [item.streetlightIdExterno, item]));
    }, [inventory]);

    const servicePointMap = useMemo(() => {
        return new Map<string, ServicePoint>(servicePoints.map(sp => [sp.nroCuenta, sp]));
    }, [servicePoints]);

    // --- Filtering Logic for EventosTab ---
    const filteredEvents = useMemo(() => {
        return allEvents.filter(event => {
            // FIX: Ensure date-fns functions are called correctly.
            if (dateRange.start && event.date < startOfDay(dateRange.start)) return false;
            if (dateRange.end && event.date > endOfDay(dateRange.end)) return false;
            if (selectedZone !== 'all' && event.zone !== selectedZone) return false;
            if (selectedMunicipio !== 'all' && event.municipio !== selectedMunicipio) return false;
            if (selectedCategory !== 'all' && event.failureCategory !== selectedCategory) return false;
            return true;
        });
    }, [allEvents, dateRange, selectedZone, selectedMunicipio, selectedCategory]);

    const displayEvents = useMemo(() => {
        if (!cardFilter) return filteredEvents;
        return filteredEvents.filter(event => {
            if (cardFilter === 'inaccesible') return event.failureCategory === 'Inaccesible';
            if (cardFilter === 'lowCurrent') return event.description.toLowerCase().includes('corriente medida es menor');
            if (cardFilter === 'highCurrent') return event.description.toLowerCase().includes('corriente medida para la combinación');
            if (cardFilter === 'voltage') return event.failureCategory === 'Falla de voltaje';
            
            // Normalize logic here as well
            const sit = normalizeString(event.situacion || '');
            if (cardFilter === 'columnaCaida') return sit.includes('columna') && sit.includes('caida');
            if (cardFilter === 'hurto') return sit.includes('hurto');
            if (cardFilter === 'vandalizado') return sit.includes('vandalizad') || sit.includes('vandalism');
            return true;
        });
    }, [filteredEvents, cardFilter]);

    // Metrics for EventosTab
    const metrics = useMemo(() => {
        let inaccesible = 0, lowCurrent = 0, highCurrent = 0, voltage = 0, columnaCaida = 0, hurto = 0, vandalizado = 0;
        filteredEvents.forEach(e => {
            if (e.failureCategory === 'Inaccesible') inaccesible++;
            if (e.description.toLowerCase().includes('corriente medida es menor')) lowCurrent++;
            if (e.description.toLowerCase().includes('corriente medida para la combinación')) highCurrent++;
            if (e.failureCategory === 'Falla de voltaje') voltage++;
            
            // Normalized check for situations
            const sit = normalizeString(e.situacion || '');
            if (sit.includes('columna') && sit.includes('caida')) columnaCaida++;
            if (sit.includes('hurto')) hurto++;
            if (sit.includes('vandalizad') || sit.includes('vandalism')) vandalizado++; 
        });
        return { inaccesible, lowCurrent, highCurrent, voltage, columnaCaida, hurto, vandalizado };
    }, [filteredEvents]);

    const handleCardClick = useCallback((filter: string) => {
        setCardFilter(prevFilter => (prevFilter === filter ? null : filter));
    }, []);

    // Oldest Events By Zone
    const oldestEventsByZone = useMemo(() => {
        const oldestMap = new Map<string, LuminaireEvent>();
        filteredEvents.forEach(event => {
            if (!oldestMap.has(event.zone) || event.date < oldestMap.get(event.zone)!.date) {
                oldestMap.set(event.zone, event);
            }
        });
        return Array.from(oldestMap.values()).sort((a, b) => {
            const indexA = ZONE_ORDER.indexOf(a.zone);
            const indexB = ZONE_ORDER.indexOf(b.zone);
            return (indexA !== -1 && indexB !== -1) ? indexA - indexB : a.zone.localeCompare(b.zone);
        });
    }, [filteredEvents]);

    // Failure Data By Zone and Municipio (for charts and tables)
    const { failureDataByZone, failureDataByMunicipio } = useMemo(() => {
        const initialFailureData = { data: [], categories: [] };
        if (filteredEvents.length === 0 || inventory.length === 0) return { failureDataByZone: initialFailureData, failureDataByMunicipio: initialFailureData };

        const allFailureCategories = Array.from(new Set(filteredEvents.map(e => e.failureCategory).filter((c): c is string => !!c && c !== 'N/A')));
        
        const calculateFailureData = (groupKey: 'zone' | 'municipio') => {
            const counts = new Map<string, { totalEvents: number; totalInventory: number; categoryCounts: Record<string, number> }>();
            
            filteredEvents.forEach(event => {
                const key = event[groupKey];
                if (!key) return;
                let entry = counts.get(key);
                if (!entry) {
                    entry = { totalEvents: 0, totalInventory: 0, categoryCounts: {} };
                    counts.set(key, entry);
                }
                entry.totalEvents++;
                if (event.failureCategory && event.failureCategory !== 'N/A') {
                    entry.categoryCounts[event.failureCategory] = (entry.categoryCounts[event.failureCategory] || 0) + 1;
                }
            });

            inventory.forEach(item => {
                const key = item[groupKey];
                if (key) {
                    let entry = counts.get(key);
                    if (!entry) {
                        entry = { totalEvents: 0, totalInventory: 0, categoryCounts: {} };
                        counts.set(key, entry);
                    }
                    entry.totalInventory++;
                }
            });

            return Array.from(counts.entries())
                .map(([name, data]) => ({
                    name,
                    eventos: data.totalEvents,
                    totalInventory: data.totalInventory, // Corrected typo
                    porcentaje: data.totalInventory > 0 ? (data.totalEvents / data.totalInventory) * 100 : 0,
                    ...data.categoryCounts
                }))
                .sort((a,b) => {
                    if (groupKey === 'zone') {
                        const indexA = ZONE_ORDER.indexOf(a.name);
                        const indexB = ZONE_ORDER.indexOf(b.name);
                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                        if (indexA !== -1) return -1;
                        if (indexB !== -1) return 1;
                    }
                    return a.name.localeCompare(b.name);
                });
        };

        return {
            failureDataByZone: { data: calculateFailureData('zone'), categories: allFailureCategories },
            failureDataByMunicipio: { data: calculateFailureData('municipio'), categories: allFailureCategories },
        };
    }, [filteredEvents, inventory]);

    // Cabinet Failure Analysis (Service Points with >= 50% inaccessible luminaires)
    const cabinetFailureAnalysisData = useMemo(() => {
        const failingServicePoints = new Map<string, { totalLuminaires: number; inaccessibleLuminaires: Set<string>; zone: string; municipio: string }>();

        const servicePointLuminaires = new Map<string, InventoryItem[]>();
        inventory.forEach(item => {
            if (item.nroCuenta && item.nroCuenta !== '-') {
                if (!servicePointLuminaires.has(item.nroCuenta)) {
                    servicePointLuminaires.set(item.nroCuenta, []);
                }
                servicePointLuminaires.get(item.nroCuenta)!.push(item);
            }
        });

        filteredEvents.forEach(event => {
            if (event.failureCategory === 'Inaccesible' && event.status === 'FAILURE') {
                const invItem = inventoryMap.get(event.id); 
                if (invItem?.nroCuenta && invItem.nroCuenta !== '-') {
                    const nroCuenta = invItem.nroCuenta;
                    if (!failingServicePoints.has(nroCuenta)) {
                        const total = servicePointLuminaires.get(nroCuenta)?.length || 0;
                        failingServicePoints.set(nroCuenta, {
                            totalLuminaires: total, // Corrected typo
                            inaccessibleLuminaires: new Set<string>(),
                            zone: invItem.zone || 'Desconocida',
                            municipio: invItem.municipio || 'Desconocido',
                        });
                    }
                    failingServicePoints.get(nroCuenta)!.inaccessibleLuminaires.add(event.id);
                }
            }
        });

        const aggregatedByZone = new Map<string, { count: number; accounts: Set<string> }>();

        failingServicePoints.forEach((data, nroCuenta) => {
            if (data.totalLuminaires === 0) return;
            const percentageInaccessible = (data.inaccessibleLuminaires.size / data.totalLuminaires) * 100;

            if (percentageInaccessible >= 50) {
                if (!aggregatedByZone.has(data.zone)) {
                    aggregatedByZone.set(data.zone, { count: 0, accounts: new Set() });
                }
                aggregatedByZone.get(data.zone)!.count++;
                aggregatedByZone.get(data.zone)!.accounts.add(nroCuenta);
            }
        });

        const sortedResult = Array.from(aggregatedByZone.entries())
            .map(([zone, data]) => ({
                name: zone,
                count: data.count,
                accounts: Array.from(data.accounts).sort(),
            }))
            .sort((a, b) => {
                const indexA = ZONE_ORDER.indexOf(a.name);
                const indexB = ZONE_ORDER.indexOf(b.name);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.name.localeCompare(b.name);
            });
        
        // console.log("Cabinet Failure Analysis Data:", sortedResult); // Depuración: Desactivado
        return sortedResult;
    }, [filteredEvents, inventory, inventoryMap]);

    // Total Unique Inaccessible Luminaires
    const totalUniqueInaccessibleLuminaires = useMemo(() => {
        const uniqueIds = new Set<string>();
        filteredEvents.forEach(e => {
            if (e.failureCategory === 'Inaccesible' && e.status === 'FAILURE') {
                uniqueIds.add(e.id);
            }
        });
        return uniqueIds.size;
    }, [filteredEvents]);

    // Inaccessible by Zone
    const inaccessibleByZoneData = useMemo(() => {
        const counts = new Map<string, Set<string>>();
        filteredEvents.forEach(e => {
            if (e.failureCategory === 'Inaccesible' && e.status === 'FAILURE') {
                if (!counts.has(e.zone)) {
                    counts.set(e.zone, new Set<string>());
                }
                counts.get(e.zone)!.add(e.id);
            }
        });
        return Array.from(counts.entries())
            .map(([name, set]) => ({ name, count: set.size }))
            .sort((a, b) => {
                const indexA = ZONE_ORDER.indexOf(a.name);
                const indexB = ZONE_ORDER.indexOf(b.name);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                return a.name.localeCompare(b.name);
            });
    }, [filteredEvents]);

    // Inaccessible by Account
    const inaccessibleByAccountData = useMemo(() => {
        const counts = new Map<string, { luminaires: Set<string>; direccion: string; zone: string; municipio: string }>();
        filteredEvents.forEach(e => {
            if (e.failureCategory === 'Inaccesible' && e.status === 'FAILURE') {
                const invItem = inventoryMap.get(e.id);
                if (invItem?.nroCuenta && invItem.nroCuenta !== '-') {
                    const nroCuenta = invItem.nroCuenta;
                    if (!counts.has(nroCuenta)) {
                        const sp = servicePointMap.get(nroCuenta);
                        counts.set(nroCuenta, {
                            luminaires: new Set<string>(),
                            direccion: sp?.direccion || 'N/A',
                            zone: invItem.zone || 'N/A',
                            municipio: invItem.municipio || 'N/A',
                        });
                    }
                    counts.get(nroCuenta)!.luminaires.add(e.id);
                }
            }
        });
        return Array.from(counts.entries())
            .map(([nroCuenta, data]) => ({ nroCuenta, count: data.luminaires.size, direccion: data.direccion, zone: data.zone, municipio: data.municipio }))
            .sort((a, b) => b.count - a.count);
    }, [filteredEvents, inventoryMap, servicePointMap]);
    

    // --- Filtering Logic for InventarioTab ---
    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            if (selectedZone !== 'all' && item.zone !== selectedZone) return false;
            if (selectedMunicipio !== 'all' && item.municipio !== selectedMunicipio) return false;
            if (selectedPower !== 'all' && item.potenciaNominal?.toString() !== selectedPower) return false;
            if (selectedCalendar !== 'all' && item.dimmingCalendar !== selectedCalendar) return false;
            return true;
        });
    }, [inventory, selectedZone, selectedMunicipio, selectedPower, selectedCalendar]);

    const finalDisplayInventory = useMemo(() => {
        if (!cardInventoryFilter) return filteredInventory;
        return filteredInventory.filter(item => {
            const value = item[cardInventoryFilter.key]?.toString();
            // Use includes for more flexible matching
            if (value && value.toLowerCase().includes(cardInventoryFilter.value.toLowerCase())) {
                return true;
            }
            return false;
        });
    }, [filteredInventory, cardInventoryFilter]);

    const handleCardInventoryClick = useCallback((key: keyof InventoryItem, value: string) => {
        setCardInventoryFilter(prevFilter => 
            (prevFilter?.key === key && prevFilter?.value === value) 
                ? null 
                : { key, value }
        );
    }, []);

    // Inventory Metrics (Dashboard Cards)
    const uniqueCabinetCount = useMemo(() => {
        const uniqueCabinets = new Set<string>();
        finalDisplayInventory.forEach(item => {
            if (item.cabinetIdExterno && item.cabinetIdExterno !== '-') {
                uniqueCabinets.add(item.cabinetIdExterno);
            }
        });
        return uniqueCabinets.size;
    }, [finalDisplayInventory]);

    const inauguratedCount = useMemo(() => {
        return finalDisplayInventory.filter(item => item.fechaInauguracion).length;
    }, [finalDisplayInventory]);

    const markedCount = useMemo(() => {
        return finalDisplayInventory.filter(item => 
            item.marked?.toLowerCase() === 'si' || item.marked?.toLowerCase() === 'yes'
        ).length;
    }, [finalDisplayInventory]);

    const uniqueAccountCount = useMemo(() => {
        const uniqueAccounts = new Set<string>();
        finalDisplayInventory.forEach(item => {
            if (item.nroCuenta && item.nroCuenta !== '-') {
                uniqueAccounts.add(item.nroCuenta);
            }
        });
        return uniqueAccounts.size;
    }, [finalDisplayInventory]);
    
    // Inventory situacion-based counts
    const vandalizadoInventoryCount = useMemo(() => {
        return finalDisplayInventory.filter(item => 
            item.situacion?.toLowerCase().includes('vandalizad') || item.situacion?.toLowerCase().includes('vandalism')
        ).length;
    }, [finalDisplayInventory]);

    const hurtoInventoryCount = useMemo(() => {
        return finalDisplayInventory.filter(item => 
            item.situacion?.toLowerCase().includes('hurto')
        ).length;
    }, [finalDisplayInventory]);

    const columnaCaidaInventoryCount = useMemo(() => {
        const normalizedCondition = (item: InventoryItem) => normalizeString(item.situacion || '');
        return finalDisplayInventory.filter(item => 
            normalizedCondition(item).includes('columna') && normalizedCondition(item).includes('caida')
        ).length;
    }, [finalDisplayInventory]);

    const faltaPodaInventoryCount = useMemo(() => {
        return finalDisplayInventory.filter(item => 
            item.situacion?.toLowerCase().includes('falta poda')
        ).length;
    }, [finalDisplayInventory]);

    const faltaLineaInventoryCount = useMemo(() => {
        return finalDisplayInventory.filter(item => 
            item.situacion?.toLowerCase().includes('falta linea')
        ).length;
    }, [finalDisplayInventory]);


    // Power Summary (Inventario Tab)
    const powerSummary: PowerSummaryTableData = useMemo(() => {
        const powerDataMap = new Map<string, Record<string, number>>(); 
        const allZonesInView = new Set<string>();
        const allMunicipiosInView = new Set<string>();

        finalDisplayInventory.forEach(item => {
            const powerKey = item.potenciaNominal ? `${item.potenciaNominal} W` : 'Desconocida';
            if (!powerDataMap.has(powerKey)) {
                powerDataMap.set(powerKey, {});
            }
            const currentPowerMap = powerDataMap.get(powerKey)!;

            if (item.zone) {
                currentPowerMap[item.zone] = (currentPowerMap[item.zone] || 0) + 1;
                allZonesInView.add(item.zone);
            }
            if (item.municipio) {
                currentPowerMap[item.municipio] = (currentPowerMap[item.municipio] || 0) + 1;
                allMunicipiosInView.add(item.municipio);
            }
        });

        const locationColumns: string[] = selectedZone === 'all' 
            ? Array.from(allZonesInView).sort((a: string,b: string) => {
                const iA = ZONE_ORDER.indexOf(a);
                const iB = ZONE_ORDER.indexOf(b);
                if (iA !== -1 && iB !== -1) return iA - iB;
                return a.localeCompare(b);
            })
            : Array.from(allMunicipiosInView).sort();

        const powerData: PowerSummaryData[] = Array.from(powerDataMap.entries())
            .map(([power, counts]) => {
                let total = 0;
                const row: PowerSummaryData = { power, total: 0 };
                locationColumns.forEach(loc => {
                    const count = counts[loc] || 0;
                    row[loc] = count;
                    total += count;
                });
                row.total = total;
                return row;
            })
            .sort((a, b) => parseInt(a.power.replace(' W', '')) - parseInt(b.power.replace(' W', '')));

        const columnTotals: Record<string, number> = {};
        locationColumns.forEach(loc => {
            columnTotals[loc] = powerData.reduce((sum, row) => sum + (row[loc] as number || 0), 0);
        });

        const grandTotal = powerData.reduce((sum, row) => sum + row.total, 0);

        return { powerData, locationColumns, columnTotals, grandTotal };
    }, [finalDisplayInventory, selectedZone]);

    const handleExportPowerSummary = useCallback(() => {
        const { powerData, locationColumns, columnTotals, grandTotal } = powerSummary;
        const dataToExport = [
            ...powerData.map(row => {
                const exportRow: Record<string, string | number> = { Potencia: row.power };
                locationColumns.forEach(col => { exportRow[col] = row[col] as number | string; });
                exportRow.Total = row.total;
                return exportRow;
            }),
            { Potencia: 'Total General', ...columnTotals, Total: grandTotal }
        ];
        exportToXlsx(dataToExport, 'resumen_potencias.xlsx');
    }, [powerSummary]);

    // Operating Hours Summary (Inventario Tab)
    const { operatingHoursSummary, operatingHoursZones, operatingHoursDetailData } = useMemo(() => {
        const ranges = OPERATING_HOURS_RANGES;
        const countsByRangeAndZone = new Map<string, Map<string, InventoryItem[]>>();
        const allZonesInView: string[] = Array.from(new Set<string>(finalDisplayInventory.map(item => item.zone).filter((z): z is string => !!z)));

        ranges.forEach(range => countsByRangeAndZone.set(range, new Map<string, InventoryItem[]>()));

        finalDisplayInventory.forEach(item => {
            if (item.horasFuncionamiento !== undefined && item.horasFuncionamiento !== null) {
                const hours = item.horasFuncionamiento;
                let matchedRange: string | null = null;
                for (const range of ranges) {
                    if (range.startsWith('>') && hours >= parseFloat(range.substring(1))) {
                        matchedRange = range;
                        break;
                    }
                    const parts = range.split('-').map(s => parseFloat(s.trim()));
                    const min = parts[0];
                    const max = parts.length > 1 ? parts[1] : undefined;

                    if (hours >= min && (max === undefined || hours < max)) {
                        matchedRange = range;
                        break;
                    }
                }
                
                if (matchedRange && item.zone) {
                    if (!countsByRangeAndZone.get(matchedRange)!.has(item.zone)) {
                        countsByRangeAndZone.get(matchedRange)!.set(item.zone, []);
                    }
                    countsByRangeAndZone.get(matchedRange)!.get(item.zone)!.push(item);
                }
            }
        });
        
        const sortedZones = Array.from(allZonesInView).sort((a: string, b: string) => {
            const iA = ZONE_ORDER.indexOf(a);
            const iB = ZONE_ORDER.indexOf(b);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1;
            if (iB !== -1) return 1;
            return a.localeCompare(b);
        });

        const summary: OperatingHoursSummary[] = ranges.map(range => {
            let total = 0;
            const row: OperatingHoursSummary = { range, total: 0 };
            sortedZones.forEach(zone => {
                const items = countsByRangeAndZone.get(range)!.get(zone) || [];
                row[zone] = items.length;
                total += items.length;
            });
            row.total = total;
            return row;
        });

        let detailData: InventoryItem[] = [];
        if (selectedOperatingHoursRange) {
            ranges.forEach(range => {
                if (range === selectedOperatingHoursRange) {
                    sortedZones.forEach(zone => {
                        const items = countsByRangeAndZone.get(range)!.get(zone) || [];
                        detailData = [...detailData, ...items];
                    });
                }
            });
        }

        return { 
            operatingHoursSummary: summary, 
            operatingHoursZones: sortedZones, 
            operatingHoursDetailData: detailData 
        };
    }, [finalDisplayInventory, selectedOperatingHoursRange]);

    const handleOperatingHoursRowClick = useCallback((range: string) => {
        // FIX: Corrected typo from `prevFilter` to `prevRange`
        setSelectedOperatingHoursRange(prevRange => (prevRange === range ? null : range));
    }, []);

    const handleExportOperatingHoursSummary = useCallback(() => {
        const dataToExport = operatingHoursSummary.map(row => {
            const exportRow: Record<string, string | number> = { 'Rango de Horas': row.range, 'Total Luminarias': row.total };
            operatingHoursZones.forEach(zone => { exportRow[zone] = row[zone]; });
            return exportRow;
        });
        exportToXlsx(dataToExport, 'resumen_horas_funcionamiento.xlsx');
    }, [operatingHoursSummary, operatingHoursZones]);

    const handleExportOperatingHoursDetail = useCallback(() => {
        exportToXlsx(operatingHoursDetailData, `detalle_horas_funcionamiento_${selectedOperatingHoursRange?.replace(/\s/g, '_')}.xlsx`);
    }, [operatingHoursDetailData, selectedOperatingHoursRange]);


    // Cabinet and Service Summaries (Inventario Tab)
    const cabinetSummaryData: CabinetSummary[] = useMemo(() => {
        const counts = new Map<string, number>();
        finalDisplayInventory.forEach(item => {
            if (item.cabinetIdExterno && item.cabinetIdExterno !== '-') {
                counts.set(item.cabinetIdExterno, (counts.get(item.cabinetIdExterno) || 0) + 1);
            }
        });
        return Array.from(counts.entries()).map(([cabinetId, luminaireCount]) => ({ cabinetId, luminaireCount }));
    }, [finalDisplayInventory]);

    const handleExportCabinetSummary = useCallback(() => {
        exportToXlsx(cabinetSummaryData, 'resumen_gabinetes.xlsx');
    }, [cabinetSummaryData]);

    const serviceSummaryData: ServiceSummary[] = useMemo(() => {
        const counts = new Map<string, { luminaireCount: number; totalPower: number }>();
        finalDisplayInventory.forEach(item => {
            if (item.nroCuenta && item.nroCuenta !== '-') {
                const current = counts.get(item.nroCuenta) || { luminaireCount: 0, totalPower: 0 };
                counts.set(item.nroCuenta, {
                    luminaireCount: current.luminaireCount + 1,
                    totalPower: current.totalPower + (item.potenciaNominal || 0)
                });
            }
        });
        return Array.from(counts.entries()).map(([nroCuenta, data]) => ({ nroCuenta, ...data }));
    }, [finalDisplayInventory]);

    const handleExportServiceSummary = useCallback(() => {
        exportToXlsx(serviceSummaryData, 'resumen_servicios.xlsx');
    }, [serviceSummaryData]);


    // --- Filtering Logic for CambiosTab ---
    const filteredChangeEvents = useMemo(() => {
        return changeEvents.filter(event => {
            // FIX: Ensure date-fns functions are called correctly.
            if (dateRange.start && event.fechaRetiro < startOfDay(dateRange.start)) return false;
            if (dateRange.end && event.fechaRetiro > endOfDay(dateRange.end)) return false;
            if (selectedZone !== 'all' && event.zone !== selectedZone) return false;
            if (selectedMunicipio !== 'all' && event.municipio !== selectedMunicipio) return false;
            if (selectedChangesYear !== event.fechaRetiro.getFullYear().toString()) return false;
            
            // Search Term filter
            if (searchTerm) {
                const lowerSearchTerm = searchTerm.toLowerCase();
                const matches = (
                    event.poleIdExterno?.toLowerCase().includes(lowerSearchTerm) ||
                    event.streetlightIdExterno?.toLowerCase().includes(lowerSearchTerm) ||
                    event.componente.toLowerCase().includes(lowerSearchTerm) ||
                    event.condicion.toLowerCase().includes(lowerSearchTerm) ||
                    event.municipio.toLowerCase().includes(lowerSearchTerm)
                );
                if (!matches) return false;
            }
            return true;
        });
    }, [changeEvents, dateRange, selectedZone, selectedMunicipio, selectedChangesYear, searchTerm]);

    const displayChangeEvents = useMemo(() => {
        if (!cardChangeFilter) return filteredChangeEvents;
        
        return filteredChangeEvents.filter(e => {
            const cond = normalizeString(e.condicion); // Use normalized string
            const comp = e.componente.toLowerCase();

            if (cardChangeFilter === 'luminaria') return comp.includes('luminaria');
            if (cardChangeFilter === 'olc') return comp.includes('olc');
            if (cardChangeFilter === 'garantia') return cond.includes('garantia');
            if (cardChangeFilter === 'vandalizado') return cond.includes('vandalizad') || cond.includes('vandalism');
            if (cardChangeFilter === 'columnaCaidaChange') return cond.includes('columna') && cond.includes('caida');
            if (cardChangeFilter === 'hurtoChange') return cond.includes('hurto');
            return true;
        });
    }, [filteredChangeEvents, cardChangeFilter]);

    const handleCardChangeClick = useCallback((filter: string) => {
        setCardChangeFilter(prevFilter => (prevFilter === filter ? null : filter));
    }, []);

    // Change Metrics (Dashboard Cards)
    const luminariaChangesCount = useMemo(() => {
        return displayChangeEvents.filter(e => e.componente.toLowerCase().includes('luminaria')).length;
    }, [displayChangeEvents]);

    const olcChangesCount = useMemo(() => {
        return displayChangeEvents.filter(e => e.componente.toLowerCase().includes('olc')).length;
    }, [displayChangeEvents]);

    const garantiaChangesCount = useMemo(() => {
        return displayChangeEvents.filter(e => normalizeString(e.condicion).includes('garantia')).length;
    }, [displayChangeEvents]);

    const vandalizadoChangesCount = useMemo(() => {
        return displayChangeEvents.filter(e => normalizeString(e.condicion).includes('vandalizad') || normalizeString(e.condicion).includes('vandalism')).length;
    }, [displayChangeEvents]);

    const columnaCaidaChangesCount = useMemo(() => {
        const count = displayChangeEvents.filter(e => {
            const normalizedCond = normalizeString(e.condicion);
            return normalizedCond.includes('columna') && normalizedCond.includes('caida');
        }).length;
        // console.log("Columna Caida Changes Count:", count); // Depuración: Desactivado
        // console.log("Display Change Events (conditions):", displayChangeEvents.map(e => e.condicion)); // Depuración: Desactivado
        return count;
    }, [displayChangeEvents]);

    const hurtoChangesCount = useMemo(() => {
        return displayChangeEvents.filter(e => normalizeString(e.condicion).includes('hurto')).length;
    }, [displayChangeEvents]);

    // Changes by Municipio (Cambios Tab)
    const changesByMunicipioData = useMemo(() => {
        const counts = new Map<string, { LUMINARIA: number; OLC: number; total: number }>();
        displayChangeEvents.forEach(e => {
            if (e.municipio) {
                if (!counts.has(e.municipio)) {
                    counts.set(e.municipio, { LUMINARIA: 0, OLC: 0, total: 0 });
                }
                const currentCounts = counts.get(e.municipio)!;
                const component = e.componente.toLowerCase();
                if (component.includes('luminaria')) {
                    currentCounts.LUMINARIA++;
                } else if (component.includes('olc')) {
                    currentCounts.OLC++;
                }
                currentCounts.total++;
            }
        });
        return Array.from(counts.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.total - a.total);
    }, [displayChangeEvents]);

    const handleExportChangesByMunicipio = useCallback(() => {
        exportToXlsx(changesByMunicipioData, 'cambios_por_municipio.xlsx');
    }, [changesByMunicipioData]);


    // Changes by Month (Cambios Tab)
    const changesByMonthData: { data: MonthlyChangesSummary[] } = useMemo(() => {
        const monthCounts = new Map<string, { LUMINARIA: number; OLC: number }>();
        const yearInt = parseInt(selectedChangesYear);

        displayChangeEvents.forEach(e => {
            if (e.fechaRetiro.getFullYear() === yearInt) {
                const monthKey = format(e.fechaRetiro, 'MM'); 
                if (!monthCounts.has(monthKey)) {
                    monthCounts.set(monthKey, { LUMINARIA: 0, OLC: 0 });
                }
                const currentCounts = monthCounts.get(monthKey)!;
                const component = e.componente.toLowerCase();
                if (component.includes('luminaria')) {
                    currentCounts.LUMINARIA++;
                } else if (component.includes('olc')) {
                    currentCounts.OLC++;
                }
            }
        });

        const monthlySummaries: MonthlyChangesSummary[] = meses.map(m => {
            const counts = monthCounts.get(m.value) || { LUMINARIA: 0, OLC: 0 };
            return {
                name: m.label,
                LUMINARIA: counts.LUMINARIA,
                OLC: counts.OLC,
                total: counts.LUMINARIA + counts.OLC,
            };
        });

        return { data: monthlySummaries };
    }, [displayChangeEvents, selectedChangesYear]);


    // Historical Changes by Condition (Cambios Tab)
    const historicalChangesByCondition: HistoricalChangesByConditionSummary[] = useMemo(() => {
        const yearlyData = new Map<string, {
            garantiaLuminaria: number; garantiaOlc: number;
            columnaCaidaLuminaria: number; columnaCaidaOlc: number;
            hurtoLuminaria: number; hurtoOlc: number;
            vandalizadoLuminaria: number; vandalizadoOlc: number;
        }>();

        changeEvents.forEach(e => {
            const year = e.fechaRetiro.getFullYear().toString();
            if (!yearlyData.has(year)) {
                yearlyData.set(year, {
                    garantiaLuminaria: 0, garantiaOlc: 0,
                    columnaCaidaLuminaria: 0, columnaCaidaOlc: 0,
                    hurtoLuminaria: 0, hurtoOlc: 0,
                    vandalizadoLuminaria: 0, vandalizadoOlc: 0,
                });
            }
            const yearCounts = yearlyData.get(year)!;
            const cond = normalizeString(e.condicion); 
            const comp = e.componente.toLowerCase();

            const isLum = comp.includes('luminaria');
            const isOlc = comp.includes('olc');

            if (cond.includes('garantia')) {
                if (isLum) yearCounts.garantiaLuminaria++;
                if (isOlc) yearCounts.garantiaOlc++;
            } else if (cond.includes('columna') && cond.includes('caida')) {
                if (isLum) yearCounts.columnaCaidaLuminaria++;
                if (isOlc) yearCounts.columnaCaidaOlc++;
            } else if (cond.includes('hurto')) {
                if (isLum) yearCounts.hurtoLuminaria++;
                if (isOlc) yearCounts.hurtoOlc++;
            } else if (cond.includes('vandalizad') || cond.includes('vandalism')) {
                if (isLum) yearCounts.vandalizadoLuminaria++;
                if (isOlc) yearCounts.vandalizadoOlc++;
            }
        });

        return Array.from(yearlyData.entries())
            .map(([year, counts]) => ({ year, ...counts }))
            .sort((a, b) => parseInt(b.year) - parseInt(a.year));
    }, [changeEvents]);


    // --- Filtering Logic for HistorialTab ---
    const filteredHistoricalData = useMemo(() => {
        if (!dateRange.start && !dateRange.end && !selectedMonth && !selectedYear) return historicalData;
        const filtered: HistoricalData = {};
        Object.entries(historicalData).forEach(([dateStr, zonesDataRaw]) => {
            const date = parse(dateStr, 'yyyy-MM-dd', new Date());
            // FIX: Ensure date-fns functions are called correctly.
            if (dateRange.start && date < startOfDay(dateRange.start)) return;
            if (dateRange.end && date > endOfDay(dateRange.end)) return;
            if (selectedYear && format(date, 'yyyy') !== selectedYear) return;
            if (selectedMonth && format(date, 'M') !== selectedMonth) return;
            
            if (!zonesDataRaw || typeof zonesDataRaw !== 'object' || Array.isArray(zonesDataRaw)) return;
            const zonesData = zonesDataRaw as Record<string, HistoricalZoneData>;

            filtered[dateStr] = zonesData; 
        });
        return filtered;
    }, [historicalData, dateRange, selectedYear, selectedMonth]);

    // Historical Tab Metrics
    const { uniqueFailuresInDateRange, uniqueFailuresByZoneInDateRange, cabinetFailuresInDateRange, cabinetFailuresForSelectedMonth } = useMemo(() => {
        const uniqueFailureIds = new Set<string>();
        const uniqueFailuresByZone = new Map<string, Set<string>>();
        const cabinetFailureDetails: CabinetFailureDetail[] = [];
        const cabinetFailureDetailsForSelectedMonth: CabinetFailureDetail[] = [];

        Object.entries(filteredHistoricalData).forEach(([dateStr, zonesDataRaw]) => {
            if (!zonesDataRaw || typeof zonesDataRaw !== 'object' || Array.isArray(zonesDataRaw)) return;
            const zonesData = zonesDataRaw as Record<string, HistoricalZoneData>;

            Object.entries(zonesData).forEach(([zoneName, zoneData]) => {
                if (zoneData.failedLuminaireIds) {
                    zoneData.failedLuminaireIds.forEach(id => {
                        uniqueFailureIds.add(id);
                        if (!uniqueFailuresByZone.has(zoneName)) {
                            uniqueFailuresByZone.set(zoneName, new Set());
                        }
                        uniqueFailuresByZone.get(zoneName)!.add(id);
                    });
                }
                if (zoneData.cabinetFailureLuminaireIds) {
                    const date = parse(dateStr, 'yyyy-MM-dd', new Date());
                    zoneData.cabinetFailureLuminaireIds.forEach(luminaireId => {
                        const invItem = inventoryMap.get(luminaireId);
                        cabinetFailureDetails.push({
                            date: date,
                            id: luminaireId,
                            zone: zoneName,
                            municipio: invItem?.municipio || 'N/A',
                        });

                        if (selectedHistoricalMonthZone && 
                            format(date, 'yyyy-MM') === selectedHistoricalMonthZone.month && 
                            zoneName === selectedHistoricalMonthZone.zone) {
                                cabinetFailureDetailsForSelectedMonth.push({
                                    date: date,
                                    id: luminaireId,
                                    zone: zoneName,
                                    municipio: invItem?.municipio || 'N/A',
                                });
                        }
                    });
                }
            });
        });

        const sortedUniqueFailuresByZone = Array.from(uniqueFailuresByZone.entries())
            .map(([name, set]) => ({ name, count: set.size }))
            .sort((a,b) => {
                const iA = ZONE_ORDER.indexOf(a.name);
                const iB = ZONE_ORDER.indexOf(b.name);
                if (iA !== -1 && iB !== -1) return iA - iB;
                return a.name.localeCompare(b.name);
            });

        return {
            uniqueFailuresInDateRange: uniqueFailureIds.size,
            uniqueFailuresByZoneInDateRange: sortedUniqueFailuresByZone,
            cabinetFailuresInDateRange: cabinetFailureDetails.sort((a, b) => b.date.getTime() - a.date.getTime()),
            cabinetFailuresForSelectedMonth: cabinetFailureDetailsForSelectedMonth.sort((a, b) => b.date.getTime() - a.date.getTime()),
        };
    }, [filteredHistoricalData, inventoryMap, selectedHistoricalMonthZone]);


    const handleExportHistoricalSummary = useCallback(() => {
        if (!filteredHistoricalData || Object.keys(filteredHistoricalData).length === 0) return;
    
        type MonthlySummaryAggregates = {
            eventos: { total: number, count: number };
            porcentaje: { total: number, count: number };
            eventosGabinete: { total: number, count: number };
            porcentajeGabinete: { total: number, count: number };
            eventosVandalismo: { total: number, count: number };
            porcentajeVandalismo: { total: number, count: number };
            eventosReales: { total: number, count: number };
            porcentajeReal: { total: number, count: number };
        };
        const monthlySummaries: Record<string, Record<string, MonthlySummaryAggregates>> = {};
        const presentZones = new Set<string>();
    
        Object.entries(filteredHistoricalData).forEach(([dateStr, zonesDataRaw]) => {
            if (!zonesDataRaw || typeof zonesDataRaw !== 'object' || Array.isArray(zonesDataRaw)) return;
            const zonesData = zonesDataRaw as Record<string, HistoricalZoneData>;

            const monthKey = format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'yyyy-MM');
            if (!monthlySummaries[monthKey]) monthlySummaries[monthKey] = {};
    
            Object.entries(zonesData).forEach(([zoneName, zoneData]) => {
                presentZones.add(zoneName);
                if (!monthlySummaries[monthKey][zoneName]) {
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
                summary.eventos.total += zoneData.eventos;
                summary.porcentaje.total += zoneData.porcentaje;
                summary.eventosGabinete.total += zoneData.eventosGabinete;
                summary.porcentajeGabinete.total += zoneData.porcentajeGabinete;
                summary.eventosVandalismo.total += zoneData.eventosVandalismo;
                summary.porcentajeVandalismo.total += zoneData.porcentajeVandalismo;
                summary.eventosReales.total += zoneData.eventosReales;
                summary.porcentajeReal.total += zoneData.porcentajeReal;
                summary.porcentaje.count++;
            });
        });
    
        const sortedZones = Array.from(presentZones).sort((a: string, b: string) => { const iA = ZONE_ORDER.indexOf(a); const iB = ZONE_ORDER.indexOf(b); if (iA !== -1 && iB !== -1) return iA - iB; if (iA !== -1) return -1; if (iB !== -1) return 1; return a.localeCompare(b); });
    
        type MonthlySummaryChartDataItem = {
            name: string;
            date: Date;
            [key: string]: string | number | Date;
        };

        const processData = (dataType: 'percentage' | 'count') => {
            const mappedData: MonthlySummaryChartDataItem[] = Object.entries(monthlySummaries).map(([monthKey, zoneAvgs]) => {
                const formattedMonth = format(parse(monthKey, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es });
                const currentMonthDate = parse(monthKey, 'yyyy-MM', new Date());

                const row: MonthlySummaryChartDataItem = {
                    name: formattedMonth,
                    date: currentMonthDate,
                };
                
                sortedZones.forEach(zone => {
                    const data = zoneAvgs[zone];
                    if (dataType === 'percentage') {
                        const avg = data && data.porcentaje.count > 0 ? (data.porcentajeReal.total / data.porcentaje.count).toFixed(2) + '%' : '0.00%';
                        row[`${zone} (% Falla Real)`] = avg;
                    } else {
                        row[`${zone} (Cant. Eventos)`] = data ? data.eventos.total : 0;
                    }
                });
                return row;
            });

            return mappedData.sort((a, b) => (b.date as Date).getTime() - (a.date as Date).getTime()).map(({ date, ...rest }) => rest);
        };
    
        interface RawPercentageDataItem {
            'Mes': string;
            'Zona': string;
            '% Falla Total': string;
            '% Falla Gabinete': string;
            '% Falla Vandalismo': string;
            '% Falla Real': string;
            date: Date;
        }

        const rawPercentageDataWithDate: RawPercentageDataItem[] = Object.entries(monthlySummaries).flatMap(([monthKey, zoneSummaries]) => {
            const monthDate = parse(monthKey, 'yyyy-MM', new Date());
            return sortedZones.map(zone => {
                const summary = zoneSummaries[zone];
                const count = summary ? summary.porcentaje.count : 0;
                return {
                    'Mes': format(monthDate, 'MMMM yyyy', { locale: es }),
                    'Zona': zone,
                    '% Falla Total': summary && count > 0 ? `${(summary.porcentaje.total / count).toFixed(2)}%` : '0.00%',
                    // FIX: Corrected typo in the key name to match RawPercentageDataItem interface.
                    '% Falla Gabinete': summary && count > 0 ? `${(summary.porcentajeGabinete.total / count).toFixed(2)}%` : '0.00%', 
                    '% Falla Vandalismo': summary && count > 0 ? `${(summary.porcentajeVandalismo.total / count).toFixed(2)}%` : '0.00%',
                    '% Falla Real': summary && count > 0 ? `${(summary.porcentajeReal.total / count).toFixed(2)}%` : '0.00%',
                    date: monthDate,
                };
            });
        });

        const percentageData = rawPercentageDataWithDate
            .sort((a, b) => b.date.getTime() - a.date.getTime())
            .map(({ date, ...rest }) => rest);

        const countsData = processData('count');
    
        exportToXlsxMultiSheet(
            [
                { sheetName: 'Desglose Porcentajes', data: percentageData },
                { sheetName: 'Cantidad Eventos', data: countsData }
            ],
            'resumen_historico.xlsx'
        );
    
    }, [filteredHistoricalData]);


    const handleSetDatePreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'year') => {
        const now = new Date();
        let start: Date, end: Date;
        switch(preset) {
            // FIX: Ensure date-fns functions are called correctly.
            case 'today': start = startOfDay(now); end = endOfDay(now); break;
            case 'yesterday': start = startOfDay(subDays(now, 1)); end = endOfDay(subDays(now, 1)); break;
            case 'week': start = subDays(now, 7); end = now; break;
            case 'month': start = startOfMonth(now); end = endOfMonth(now); break;
            case 'year': start = startOfYear(now); end = endOfYear(now); break;
        }
        setDateRange({ start, end });
        setSelectedMonth('');
        setSelectedYear('');
    };

    const handleClearFilters = () => {
        setDateRange({ start: null, end: null });
        setSelectedZone('all');
        setSelectedMunicipio('all');
        setSelectedCategory('all');
        setSelectedPower('all');
        setSelectedCalendar('all');
        setCardFilter(null);
        setCardInventoryFilter(null);
        setCardChangeFilter(null);
        setSelectedMonth('');
        setSelectedYear('');
        setSearchTerm('');
    };

    if (authLoading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-cyan-400">Cargando autenticación...</div>;
    if (!user) return <AuthPage />;
    if (userProfile && userProfile.accessStatus === 'pending') {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Su cuenta está pendiente de aprobación por un administrador.</div>;
    }
    if (userProfile && userProfile.accessStatus === 'rejected') {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">Su solicitud de acceso ha sido rechazada.</div>;
    }

    const hasNoData = !dataLoading && !dataError && 
        allEvents.length === 0 && 
        changeEvents.length === 0 && 
        inventory.length === 0 && 
        servicePoints.length === 0 && 
        zoneBases.length === 0 &&
        Object.keys(historicalData).length === 0;

    return (
        <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100 font-sans">
            <Header latestDataDate={allEvents.length > 0 ? allEvents[0].date : null} userProfile={userProfile} />
            <main className="flex-grow container mx-auto px-4 md:px-8 py-6 space-y-6">
                <FilterControls 
                    activeTab={activeTab}
                    userProfile={userProfile}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    handleSetDatePreset={handleSetDatePreset}
                    selectedZone={selectedZone}
                    setSelectedZone={setSelectedZone}
                    selectedMunicipio={selectedMunicipio}
                    setSelectedMunicipio={setSelectedMunicipio}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    zones={zones}
                    municipios={municipios}
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
                    handleClearFilters={handleClearFilters}
                />
                
                <div className="flex border-b border-gray-700 overflow-x-auto">
                    <TabButton tabId="inventario" title="Inventario" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={() => {}} />
                    <TabButton tabId="eventos" title="Eventos" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={() => {}} />
                    <TabButton tabId="cambios" title="Cambios" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={() => {}} />
                    <TabButton tabId="historial" title="Historial de Eventos" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={() => {}} />
                    <TabButton tabId="mantenimiento" title="Mantenimiento" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={() => {}} />
                    {userProfile?.role === 'administrador' && (
                        <TabButton tabId="admin" title="Administración" activeTab={activeTab} setActiveTab={setActiveTab} onPopOut={() => {}} />
                    )}
                </div>

                {dataLoading && <div className="min-h-[200px] flex items-center justify-center text-cyan-400">Cargando datos...</div>}
                {dataError && (
                    <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-center">
                        <p className="font-semibold text-lg mb-2">Error al cargar datos:</p>
                        <p>{dataError}</p>
                        <p className="mt-2 text-sm">Por favor, revise la consola del navegador para más detalles.</p>
                    </div>
                )}
                {hasNoData && (
                    <div className="p-4 bg-yellow-900/50 border border-yellow-700 rounded-lg text-yellow-300 text-center" role="alert">
                        <p className="font-semibold text-lg mb-2">No se encontraron datos</p>
                        <p>No se pudo cargar ningún dato de las planillas de Google Drive o los datos procesados estaban vacíos. Por favor, asegúrese de que:</p>
                        <ul className="list-disc list-inside mt-2 text-left mx-auto max-w-sm">
                            <li>Las URLs en su base de datos de Firebase Realtime (`/dataSourceURLs.json`) son correctas y terminan en `/export?format=csv`.</li>
                            <li>Las planillas de Google Sheets están configuradas para ser "Públicas" o "Cualquier persona con el enlace puede ver".</li>
                            <li>Las planillas no están vacías y los encabezados de las columnas coinciden con los esperados por la aplicación.</li>
                            <li>Revise la consola del navegador (F12) para ver mensajes de advertencia o error específicos durante la carga.</li>
                        </ul>
                    </div>
                )}

                {!dataLoading && !dataError && !hasNoData && (
                    <>
                        {activeTab === 'eventos' && (
                            <EventosTab 
                                baseFilteredEvents={displayEvents}
                                displayEvents={displayEvents}
                                oldestEventsByZone={oldestEventsByZone} 
                                failureDataByZone={failureDataByZone} 
                                failureDataByMunicipio={failureDataByMunicipio} 
                                servicePoints={servicePoints}
                                inaccesibleFailures={metrics.inaccesible}
                                lowCurrentFailures={metrics.lowCurrent}
                                highCurrentFailures={metrics.highCurrent}
                                voltageFailures={metrics.voltage}
                                columnaCaidaFailures={metrics.columnaCaida}
                                hurtoFailures={metrics.hurto}
                                vandalizadoFailures={metrics.vandalizado}
                                cardFilter={cardFilter}
                                cabinetFailureAnalysisData={cabinetFailureAnalysisData}
                                selectedZoneForCabinetDetails={selectedZoneForCabinetDetails}
                                handleCardClick={handleCardClick}
                                handleExportFailureByZone={() => exportToXlsx(failureDataByZone.data, 'fallas_por_zona.xlsx')}
                                handleExportFailureByMunicipio={() => exportToXlsx(failureDataByMunicipio.data, 'fallas_por_municipio.xlsx')}
                                handleExportFilteredEvents={() => exportToXlsx(displayEvents, 'eventos_filtrados.xlsx')}
                                handleCabinetZoneRowClick={setSelectedZoneForCabinetDetails}
                                handleExportCabinetFailureAnalysis={() => exportToXlsx(cabinetFailureAnalysisData.flatMap(z => z.accounts.map(acc => ({ Zona: z.name, 'Nro. Cuenta': acc }))), 'servicios_con_falla.xlsx')}
                                handleOpenMapModal={() => {}} // This isn't implemented in the current scope for events tab directly
                                totalUniqueInaccessibleLuminaires={totalUniqueInaccessibleLuminaires}
                                inaccessibleByZoneData={inaccessibleByZoneData}
                                inaccessibleByAccountData={inaccessibleByAccountData}
                            />
                        )}
                        {activeTab === 'historial' && (
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
                        )}
                        {activeTab === 'mantenimiento' && (
                            <RutasTab // Corrected component name
                                allEvents={allEvents} 
                                inventory={inventory} 
                                zoneBases={zoneBases} 
                                zones={zones} 
                                cabinetFailureAnalysisData={cabinetFailureAnalysisData} 
                                servicePoints={servicePoints} 
                            />
                        )}
                        {activeTab === 'admin' && <AdminTab allZones={zones} />}
                         {activeTab === 'inventario' && (
                            <InventarioTab 
                                displayInventory={finalDisplayInventory}
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
                         )}
                         {activeTab === 'cambios' && (
                            <CambiosTab 
                                baseFilteredChangeEvents={changeEvents}
                                displayChangeEvents={displayChangeEvents}
                                changesByMunicipioData={changesByMunicipioData}
                                changesByMonthData={changesByMonthData}
                                historicalChangesByCondition={historicalChangesByCondition}
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
                            />
                         )}
                    </>
                )}
            </main>
        </div>
    );
};

export { App };