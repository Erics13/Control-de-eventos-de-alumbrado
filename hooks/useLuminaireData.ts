import { useState, useEffect, useCallback } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LuminaireEvent, ChangeEvent, InventoryItem, DataSourceURLs, HistoricalData, HistoricalZoneData, ServicePoint, ZoneBase } from '../types';
import { MUNICIPIO_TO_ZONE_MAP, FAILURE_CATEGORY_TRANSLATIONS, ZONE_ORDER } from '../constants';
import { format } from 'date-fns/format';

// --- IndexedDB Logic ---
const DB_NAME = 'LuminaireDataDB';
const DB_VERSION = 9; 
const LUMINAIRE_EVENTS_STORE = 'luminaireEvents';
const CHANGE_EVENTS_STORE = 'changeEvents';
const INVENTORY_STORE = 'inventory'; 
const SERVICE_POINTS_STORE = 'servicePoints';
const ZONE_BASES_STORE = 'zoneBases';

// --- Firebase Config ---
const FIREBASE_BASE_URL = 'https://gestion-de-fallas-default-rtdb.firebaseio.com';
const FIREBASE_URLS_PATH = '/dataSourceURLs.json';
const FIREBASE_HISTORY_PATH = '/historicalSnapshots';


interface LuminaireDB extends DBSchema {
  [LUMINAIRE_EVENTS_STORE]: {
    key: string;
    value: LuminaireEvent;
    indexes: { date: Date; };
  };
  [CHANGE_EVENTS_STORE]: {
    key: string;
    value: ChangeEvent;
    indexes: { fechaRetiro: Date; };
  };
  [INVENTORY_STORE]: {
    key: string;
    value: InventoryItem;
  };
  [SERVICE_POINTS_STORE]: {
    key: string;
    value: ServicePoint;
  };
  [ZONE_BASES_STORE]: {
    key: string;
    value: ZoneBase;
  };
}

let dbPromise: Promise<IDBPDatabase<LuminaireDB>> | null = null;

const getDb = () => {
    if (!dbPromise) {
        dbPromise = openDB<LuminaireDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(LUMINAIRE_EVENTS_STORE)) {
                    const luminaireStore = db.createObjectStore(LUMINAIRE_EVENTS_STORE, { keyPath: 'uniqueEventId' });
                    luminaireStore.createIndex('date', 'date');
                }
                 if (!db.objectStoreNames.contains(CHANGE_EVENTS_STORE)) {
                    const changeStore = db.createObjectStore(CHANGE_EVENTS_STORE, { keyPath: 'uniqueId' });
                    changeStore.createIndex('fechaRetiro', 'fechaRetiro');
                }
                 if (!db.objectStoreNames.contains(INVENTORY_STORE)) {
                    db.createObjectStore(INVENTORY_STORE, { keyPath: 'streetlightIdExterno' });
                }
                 if (!db.objectStoreNames.contains(SERVICE_POINTS_STORE)) {
                    db.createObjectStore(SERVICE_POINTS_STORE, { keyPath: 'nroCuenta' });
                }
                 if (!db.objectStoreNames.contains(ZONE_BASES_STORE)) {
                    db.createObjectStore(ZONE_BASES_STORE, { keyPath: 'zoneName' });
                }
            },
        });
    }
    return dbPromise;
};

// --- Helper Functions ---
const detectDelimiter = (header: string): string => {
    const commaCount = (header.match(/,/g) || []).length;
    const semicolonCount = (header.match(/;/g) || []).length;
    return semicolonCount > commaCount ? ';' : ',';
};

const parseCsvRow = (row: string, delimiter: string): string[] => {
    const columns: string[] = [];
    if (!row) return columns;
    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Regex to handle quoted fields containing delimiters
    const regex = new RegExp(`(?:"((?:[^"]|"")*)"|([^${escapedDelimiter}]*))(${escapedDelimiter}|$)`, 'g');

    let match;
    while ((match = regex.exec(row))) {
        // match[1] is the content inside quotes, match[2] is content without quotes
        let column = match[1] !== undefined ? match[1].replace(/""/g, '"') : (match[2] || '');
        columns.push(column.trim());
        if (match[3] === '') break; // Reached end of row
    }
    return columns;
};

const parseCustomDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null;
    const trimmedStr = dateStr.trim();
    // Try to parse 'dd/MM/yyyy HH:mm'
    const match = trimmedStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s(\d{1,2}):(\d{1,2})$/);
    if (match) {
        const [, day, month, year, hour, minute] = match.map(Number);
        const fullYear = year < 100 ? year + 2000 : year; // Handle 2-digit years
        const date = new Date(fullYear, month - 1, day, hour, minute);
        return isNaN(date.getTime()) ? null : date;
    }
    // Fallback for ISO format or other standard formats if needed
    try {
        const date = new Date(trimmedStr);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
};

const parseNumberFromCSV = (numStr: string | undefined): number | undefined => {
    if (!numStr || numStr.trim() === '' || numStr.toLowerCase().trim() === 'n/a') return undefined;
    
    // Attempt to parse with comma as decimal separator first (common in Spanish locales)
    let cleanedStr = numStr.trim();
    if (cleanedStr.includes(',') && !cleanedStr.includes('.')) {
        cleanedStr = cleanedStr.replace(',', '.');
    } else if (cleanedStr.includes('.') && cleanedStr.includes(',') && cleanedStr.indexOf('.') < cleanedStr.indexOf(',')) {
        // If dot is thousands separator and comma is decimal separator (e.g., "1.234,56")
        cleanedStr = cleanedStr.replace(/\./g, '').replace(',', '.');
    }
    
    const parsed = parseFloat(cleanedStr);
    return isNaN(parsed) ? undefined : parsed;
};


// --- React Hook ---
export const useLuminaireData = () => {
    const [allEvents, setAllEvents] = useState<LuminaireEvent[]>([]);
    const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
    const [zoneBases, setZoneBases] = useState<ZoneBase[]>([]);
    const [historicalData, setHistoricalData] = useState<HistoricalData>({});
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const processEventsCSV = (text: string): LuminaireEvent[] => {
        const lines = text.split('\n');
        if (lines.length <= 1) return [];
        const header = lines[0];
        const rows = lines.slice(1);
        const delimiter = detectDelimiter(header);
        // console.log("Events Delimiter:", delimiter);

        const parsedEvents: LuminaireEvent[] = [];
        rows.forEach((row, rowIndex) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            // console.log(`Events Row ${rowIndex}:`, columns);
            if (columns.length < 14) {
                console.warn(`Events: Skipping row ${rowIndex} due to insufficient columns (${columns.length} < 14):`, columns);
                return;
            }
            const eventDate = parseCustomDate(columns[13]?.trim());
            if (!eventDate) {
                console.warn(`Events: Skipping row ${rowIndex} due to invalid date '${columns[13]}'`, columns);
                return;
            }
            const uniqueEventId = columns[11]?.trim();
            if (!uniqueEventId) {
                console.warn(`Events: Skipping row ${rowIndex} due to missing uniqueEventId`, columns);
                return;
            }
            
            const description = columns[12]?.trim() || '';
            const situacion = columns[8]?.trim() || '';
            const situacionLower = situacion.toLowerCase();
            
            let specialFailureCategory: string | undefined = undefined;
            if (situacionLower.includes('columna') && situacionLower.includes('caida')) { specialFailureCategory = 'Columna Caída'; }
            else if (situacionLower.includes('hurto')) { specialFailureCategory = 'Hurto'; }
            else if (situacionLower.includes('vandalizad') || situacionLower.includes('vandalism')) { specialFailureCategory = 'Vandalizado'; }
            
            const category = columns[10]?.trim();
            const translatedCategory = FAILURE_CATEGORY_TRANSLATIONS[category!];
            
            // Prioritize technical event category over situation category if both exist
            const finalFailureCategory = (translatedCategory && translatedCategory !== 'N/A' ? translatedCategory : undefined) || specialFailureCategory;
            const eventStatus = finalFailureCategory ? 'FAILURE' : 'OPERATIONAL'; // Status is FAILURE if any category is determined

            const municipio = columns[0]?.trim() || 'N/A';
            const municipioUpper = municipio.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') return;
            
            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            
            const lat = parseNumberFromCSV(columns[5]);
            const lon = parseNumberFromCSV(columns[6]);
            const systemMeasuredPower = parseNumberFromCSV(columns[14]);

            parsedEvents.push({
                uniqueEventId, id: columns[4]?.trim(), olcId: columns[3]?.trim(), power: columns[2]?.trim(),
                date: eventDate, municipio, zone, status: eventStatus, description, failureCategory: finalFailureCategory,
                lat: lat, lon: lon,
                systemMeasuredPower,
                situacion: situacionLower // Store lowercased for consistent filtering
            });
        });
        // console.log("Parsed Events:", parsedEvents.length, parsedEvents);
        return parsedEvents;
    };

    const processChangeEventsCSV = (text: string): ChangeEvent[] => {
        const lines = text.split('\n');
        if (lines.length <= 1) return [];
        const header = lines[0];
        const rows = lines.slice(1);
        const delimiter = detectDelimiter(header);
        // console.log("Change Events Delimiter:", delimiter);
        
        const parsedChangeEvents: ChangeEvent[] = [];
        rows.forEach((row, rowIndex) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            // console.log(`Change Events Row ${rowIndex}:`, columns);
            if (columns.length < 12) {
                console.warn(`Change Events: Skipping row ${rowIndex} due to insufficient columns (${columns.length} < 12):`, columns);
                return;
            }
            const fechaRetiro = parseCustomDate(columns[0]?.trim());
            if (!fechaRetiro) {
                console.warn(`Change Events: Skipping row ${rowIndex} due to invalid date '${columns[0]}'`, columns);
                return;
            }
            const poleIdExterno = columns[2]?.trim();
            if (!poleIdExterno) {
                console.warn(`Change Events: Skipping row ${rowIndex} due to missing poleIdExterno`, columns);
                return;
            }
            
            const municipio = columns[5]?.trim() || 'N/A';
            const municipioUpper = municipio.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') return;

            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            const lat = parseNumberFromCSV(columns[6]);
            const lon = parseNumberFromCSV(columns[7]);
            
            const condicion = columns[1]?.trim().toLowerCase(); // Store lowercased for consistent filtering

            parsedChangeEvents.push({
                uniqueId: `${poleIdExterno}-${fechaRetiro.toISOString()}-${columns[9]?.trim()}`, fechaRetiro,
                condicion: condicion, 
                poleIdExterno,
                horasFuncionamiento: parseNumberFromCSV(columns[3]) ?? 0,
                recuentoConmutacion: parseNumberFromCSV(columns[4]) ?? 0,
                municipio, zone, lat: lat, lon: lon,
                streetlightIdExterno: columns[8]?.trim(), componente: columns[9]?.trim(),
                designacionTipo: columns[10]?.trim(), cabinetIdExterno: columns[11]?.trim(),
            });
        });
        // console.log("Parsed Change Events:", parsedChangeEvents.length, parsedChangeEvents);
        return parsedChangeEvents;
    };

    const processInventoryCSV = (text: string): InventoryItem[] => {
        const lines = text.split('\n');
        if (lines.length <= 1) return [];
        const header = lines[0];
        const rows = lines.slice(1);
        const delimiter = detectDelimiter(header);
        // console.log("Inventory Delimiter:", delimiter);

        const parsedItems: InventoryItem[] = [];
        rows.forEach((row, rowIndex) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            // console.log(`Inventory Row ${rowIndex}:`, columns);
            if (columns.length < 24) {
                 console.warn(`Inventory: Skipping row ${rowIndex} due to insufficient columns (${columns.length} < 24):`, columns);
                 return;
            }
            const streetlightIdExterno = columns[1]?.trim();
            if (!streetlightIdExterno) {
                console.warn(`Inventory: Skipping row ${rowIndex} due to missing streetlightIdExterno`, columns);
                return;
            }

            const municipio = columns[0]?.trim() || 'N/A';
            const municipioUpper = municipio.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') return;

            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            
            const lat = parseNumberFromCSV(columns[2]);
            const lon = parseNumberFromCSV(columns[3]);
            const cabinetLat = parseNumberFromCSV(columns[20]);
            const cabinetLon = parseNumberFromCSV(columns[21]);
            const olcIdExterno = parseInt(columns[15]?.trim(), 10);
            
            const situacion = columns[5]?.trim().toLowerCase(); // Store lowercased for consistent filtering

            parsedItems.push({
                streetlightIdExterno, municipio, zone, lat: lat,
                lon: lon, nroCuenta: columns[4]?.trim(),
                situacion: situacion, localidad: columns[6]?.trim(),
                fechaInstalacion: parseCustomDate(columns[7]?.trim()) ?? undefined,
                marked: columns[8]?.trim(), estado: columns[9]?.trim(),
                fechaInauguracion: parseCustomDate(columns[10]?.trim()) ?? undefined,
                olcHardwareDir: columns[11]?.trim(), dimmingCalendar: columns[12]?.trim(),
                ultimoInforme: parseCustomDate(columns[13]?.trim()) ?? undefined,
                olcIdExterno: !isNaN(olcIdExterno) ? olcIdExterno : undefined,
                luminaireIdExterno: columns[16]?.trim(),
                horasFuncionamiento: parseNumberFromCSV(columns[17]),
                recuentoConmutacion: parseNumberFromCSV(columns[18]),
                cabinetIdExterno: columns[19]?.trim(),
                cabinetLat: cabinetLat,
                cabinetLon: cabinetLon,
                potenciaNominal: parseNumberFromCSV(columns[22]),
                designacionTipo: columns[23]?.trim(),
            });
        });
        // console.log("Parsed Inventory:", parsedItems.length, parsedItems);
        return parsedItems;
    };

    const processServicePointsCSV = (text: string): ServicePoint[] => {
        const lines = text.split('\n');
        if (lines.length <= 1) return [];
        const header = lines[0];
        const rows = lines.slice(1);
        const delimiter = detectDelimiter(header);
        // console.log("Service Points Delimiter:", delimiter);
        const parsedItems: ServicePoint[] = [];

        rows.forEach((row, rowIndex) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            // console.log(`Service Points Row ${rowIndex}:`, columns);
            // Expected 11 columns based on the current provided data from logs:
            // Tarifa (0), PotContrat (1), Direccion (2), ALCID (3), Num_Cuenta (4), ZONA (5), Porcent_ef (6), FASES (7), TENSION (8), POINT_X (9), POINT_Y (10)
            if (columns.length < 11) { 
                 console.warn(`Service Points: Skipping row ${rowIndex} due to insufficient columns (${columns.length} < 11):`, columns);
                 return;
            }

            const nroCuenta = columns[4]?.trim(); // Mapped to Num_Cuenta
            if (!nroCuenta) {
                console.warn(`Service Points: Skipping row ${rowIndex} due to missing nroCuenta`, columns);
                return;
            }

            // Corrected indices based on the 11-column schema
            const lon = parseNumberFromCSV(columns[9]); // Mapped to POINT_X (index 9)
            const lat = parseNumberFromCSV(columns[10]); // Mapped to POINT_Y (index 10)
            
            if (lat === undefined || lon === undefined) {
                console.warn(`Service Points: Invalid coordinates for service point ${nroCuenta}: Lat='${columns[10]}', Lon='${columns[9]}'. Skipping. Raw columns:`, columns);
                return;
            }

            parsedItems.push({
                nroCuenta,
                tarifa: columns[0]?.trim(), // Mapped to Tarifa
                potenciaContratada: parseNumberFromCSV(columns[1]) ?? 0, // Mapped to PotContrat
                tension: columns[8]?.trim(), // Mapped to TENSION
                fases: columns[7]?.trim(), // Mapped to FASES
                cantidadLuminarias: 0, // Will be calculated from inventory
                direccion: columns[2]?.trim(), // Mapped to Direccion
                lat: lat,
                lon: lon,
                alcid: columns[3]?.trim(), // Mapped to ALCID (Municipality Code/Name)
                porcentEf: parseNumberFromCSV(columns[6]), // Mapped to Porcent_ef
            });
        });
        // console.log("Parsed Service Points:", parsedItems.length, parsedItems);
        return parsedItems;
    };

    const processZoneBasesCSV = (text: string): ZoneBase[] => {
        const lines = text.split('\n');
        if (lines.length <= 1) return [];
        const header = lines[0];
        const rows = lines.slice(1);
        const delimiter = detectDelimiter(header);
        // console.log("Zone Bases Delimiter:", delimiter);

        const parsedItems: ZoneBase[] = [];
        rows.forEach((row, rowIndex) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row.trim(), delimiter);
            // console.log(`Zone Bases Row ${rowIndex}:`, columns);
            if (columns.length < 3) {
                console.warn(`Zone Bases: Skipping row ${rowIndex} due to insufficient columns (${columns.length} < 3):`, columns);
                return;
            }

            const zoneName = columns[0]?.trim().toUpperCase();
            if (!zoneName) {
                console.warn(`Zone Bases: Skipping row ${rowIndex} due to missing zoneName`, columns);
                return;
            }

            const lat = parseNumberFromCSV(columns[1]);
            const lon = parseNumberFromCSV(columns[2]);
            
            if (lat !== undefined && lon !== undefined) {
                 parsedItems.push({ zoneName, lat: lat, lon: lon });
            } else {
                 console.warn(`Zone Bases: Invalid coordinates for zone ${zoneName}: Lat='${columns[1]}', Lon='${columns[2]}'. Skipping. Raw columns:`, columns);
            }
        });
        // console.log("Parsed Zone Bases:", parsedItems.length, parsedItems);
        return parsedItems;
    };


    const calculateDailySnapshot = (
        dailyEvents: LuminaireEvent[],
        fullInventory: InventoryItem[]
    ): Record<string, HistoricalZoneData> => {
        const inventoryMap = new Map<string, InventoryItem>(fullInventory.map(item => [item.streetlightIdExterno, item]));
        const luminairesByCabinet = fullInventory.reduce((acc, item) => {
            if (item.cabinetIdExterno && item.cabinetIdExterno !== '-') {
                if (!acc[item.cabinetIdExterno]) acc[item.cabinetIdExterno] = [];
                acc[item.cabinetIdExterno].push(item.streetlightIdExterno);
            }
            return acc;
        }, {} as Record<string, string[]>);
    
        const inventoryCountByZone = fullInventory.reduce((acc, item) => {
            if (item.zone) acc[item.zone] = (acc[item.zone] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    
        const dailyFailureEvents = dailyEvents.filter(e => e.status === 'FAILURE');
        const failureCategories = Array.from(new Set(dailyFailureEvents.map(e => e.failureCategory).filter((c): c is string => !!c)));
    
        const countsByZone: Record<string, Omit<HistoricalZoneData, 'name' | 'totalInventario' | 'porcentaje' | 'porcentajeGabinete' | 'porcentajeVandalismo' | 'porcentajeReal' | 'failedLuminaireIds' | 'cabinetFailureLuminaireIds'>> = {};
        const cabinetFailureLuminaireIdsByZone: Record<string, string[]> = {};
    
        // Initialize counts for all zones
        Object.keys(inventoryCountByZone).forEach(zone => {
            countsByZone[zone] = {
                eventos: 0, eventosGabinete: 0, eventosVandalismo: 0, eventosReales: 0
            };
            failureCategories.forEach(cat => { countsByZone[zone][cat] = 0; });
        });
    
        const inaccessibleEventsByCabinet: Record<string, LuminaireEvent[]> = {};
        const vandalizedEvents = new Set<string>(); // Store uniqueEventId
    
        // First pass: Categorize vandalism and group inaccessible events
        dailyFailureEvents.forEach(event => {
            const inventoryItem = inventoryMap.get(event.id);
            if (inventoryItem?.situacion?.toUpperCase().startsWith('VANDALIZADO')) {
                if (countsByZone[event.zone]) {
                    countsByZone[event.zone].eventosVandalismo++;
                    vandalizedEvents.add(event.uniqueEventId);
                }
            } else if (event.failureCategory === 'Inaccesible' && inventoryItem?.cabinetIdExterno) {
                const cabinetId = inventoryItem.cabinetIdExterno;
                if (!inaccessibleEventsByCabinet[cabinetId]) inaccessibleEventsByCabinet[cabinetId] = [];
                inaccessibleEventsByCabinet[cabinetId].push(event);
            }
        });
    
        // Second pass: Identify cabinet failures from grouped inaccessible events
        Object.values(inaccessibleEventsByCabinet).forEach(events => {
            if (events.length > 0) {
                const cabinetId = inventoryMap.get(events[0].id)?.cabinetIdExterno;
                const totalInCabinet = cabinetId ? (luminairesByCabinet[cabinetId]?.length || 0) : 0;
                // Condition for cabinet failure: all luminaires in the cabinet are inaccessible and there's more than one.
                if (cabinetId && totalInCabinet > 1 && (events.length === totalInCabinet)) {
                    events.forEach(event => {
                        if (countsByZone[event.zone]) {
                            countsByZone[event.zone].eventosGabinete++;
                            if (!cabinetFailureLuminaireIdsByZone[event.zone]) {
                                cabinetFailureLuminaireIdsByZone[event.zone] = [];
                            }
                            cabinetFailureLuminaireIdsByZone[event.zone].push(event.id);
                        }
                    });
                }
            }
        });
    
        // Final pass: Aggregate total and real events
        dailyFailureEvents.forEach(event => {
            if (countsByZone[event.zone]) {
                countsByZone[event.zone].eventos++;
                if (event.failureCategory) {
                    countsByZone[event.zone][event.failureCategory] = (countsByZone[event.zone][event.failureCategory] || 0) + 1;
                }
            }
        });
    
        const snapshot: Record<string, HistoricalZoneData> = {};
        Object.keys(inventoryCountByZone).forEach(zone => {
            const zoneCounts = countsByZone[zone];
            const totalInventario = inventoryCountByZone[zone];
            
            const eventosReales = Math.max(0, zoneCounts.eventos - zoneCounts.eventosGabinete - zoneCounts.eventosVandalismo);
            
            const failedLuminaireIds = Array.from(new Set(dailyFailureEvents.filter(e => e.zone === zone).map(e => e.id)));

            const snapshotForZone: HistoricalZoneData = {
                name: zone,
                eventos: zoneCounts.eventos,
                eventosGabinete: zoneCounts.eventosGabinete,
                eventosVandalismo: zoneCounts.eventosVandalismo,
                eventosReales,
                totalInventario,
                porcentaje: totalInventario > 0 ? (zoneCounts.eventos / totalInventario) * 100 : 0,
                porcentajeGabinete: totalInventario > 0 ? (zoneCounts.eventosGabinete / totalInventario) * 100 : 0,
                porcentajeVandalismo: totalInventario > 0 ? (zoneCounts.eventosVandalismo / totalInventario) * 100 : 0,
                porcentajeReal: totalInventario > 0 ? (eventosReales / totalInventario) * 100 : 0,
                failedLuminaireIds: failedLuminaireIds,
                cabinetFailureLuminaireIds: cabinetFailureLuminaireIdsByZone[zone] || [],
            };
            
            failureCategories.forEach(cat => {
                 snapshotForZone[cat] = zoneCounts[cat] || 0;
            });

            snapshot[zone] = snapshotForZone;
        });
        return snapshot;
    };


    const fetchAndProcessData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        const db = await getDb();

        let urls: DataSourceURLs;
        try {
            console.log("Attempting to fetch data source URLs from Firebase...");
            const firebaseResponse = await fetch(FIREBASE_BASE_URL + FIREBASE_URLS_PATH);
            if (!firebaseResponse.ok) {
                throw new Error(`Error al conectar con Firebase: ${firebaseResponse.statusText} (${firebaseResponse.status})`);
            }
            const data = await firebaseResponse.json();
            if (!data || !data.events || !data.changes || !data.inventory || !data.servicePoints || !data.zoneBases) {
                throw new Error("La configuración de URLs en Firebase es inválida o no se encontró.");
            }
            urls = data as DataSourceURLs;
            console.log("URLs de fuentes de datos cargadas desde Firebase:", urls);
        } catch (e: any) {
            console.error("Failed to fetch URLs from Firebase", e);
            setError(`No se pudo obtener la configuración de Firebase: ${e.message}. Intentando cargar desde la caché...`);
            try {
                const [cachedEvents, cachedChanges, cachedInventory, cachedServicePoints, cachedZoneBases, cachedHistory] = await Promise.all([
                    db.getAll(LUMINAIRE_EVENTS_STORE),
                    db.getAll(CHANGE_EVENTS_STORE),
                    db.getAll(INVENTORY_STORE),
                    db.getAll(SERVICE_POINTS_STORE),
                    db.getAll(ZONE_BASES_STORE),
                    fetch(FIREBASE_BASE_URL + FIREBASE_HISTORY_PATH + '.json')
                        .then(res => { if (!res.ok) throw new Error(res.statusText); return res.json() as Promise<HistoricalData>; })
                        .catch(e => { console.warn("Failed to fetch historical data from Firebase:", e); return {} as HistoricalData; })
                ]);
                setAllEvents(cachedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
                setChangeEvents(cachedChanges.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
                setInventory(cachedInventory);
                setServicePoints(cachedServicePoints);
                setZoneBases(cachedZoneBases);
                setHistoricalData(cachedHistory || {});
                 if (cachedEvents.length === 0 && cachedChanges.length === 0 && cachedInventory.length === 0) {
                    setError(`No se pudo obtener la configuración de Firebase: ${e.message}. No hay datos en la caché.`);
                } else {
                    setError(null); // Clear error if cached data was loaded successfully
                    console.log("Loaded data from IndexedDB cache.");
                }
            } catch (dbError) {
                console.error("Error loading from DB/Firebase after Firebase URL failure:", dbError);
                setError(`No se pudo obtener la configuración de Firebase y también falló la carga desde la caché.`);
            } finally {
                setLoading(false);
            }
            return;
        }

        try {
            console.log("Attempting to fetch CSV files...");
            const [
                eventsResponse,
                changesResponse,
                inventoryResponse,
                servicePointsResponse,
                zoneBasesResponse,
            ] = await Promise.all([
                fetch(urls.events).catch(e => { throw new Error(`Eventos: ${e.message}`); }),
                fetch(urls.changes).catch(e => { throw new Error(`Cambios: ${e.message}`); }),
                fetch(urls.inventory).catch(e => { throw new Error(`Inventario: ${e.message}`); }),
                fetch(urls.servicePoints).catch(e => { throw new Error(`Puntos de Servicio: ${e.message}`); }),
                fetch(urls.zoneBases).catch(e => { throw new Error(`Bases de Zona: ${e.message}`); }),
            ]);

            const responses = [eventsResponse, changesResponse, inventoryResponse, servicePointsResponse, zoneBasesResponse];
            for (const res of responses) {
                if (!res.ok) throw new Error(`Error al cargar ${res.url}: ${res.statusText} (${res.status})`);
            }
             
            // Fetch historical data separately, allowing app to proceed even if it fails
            let history: HistoricalData = {};
            try {
                console.log("Attempting to fetch historical snapshot data...");
                const historicalDataResponse = await fetch(FIREBASE_BASE_URL + FIREBASE_HISTORY_PATH + '.json');
                if (!historicalDataResponse.ok) {
                    console.warn(`Could not fetch historical data: ${historicalDataResponse.statusText} (${historicalDataResponse.status}). Proceeding without it.`);
                } else {
                    history = await historicalDataResponse.json() as HistoricalData;
                    console.log("Historical data loaded.");
                }
            } catch (histError) {
                console.warn("Failed to fetch historical data, proceeding without it:", histError);
            }
            setHistoricalData(history || {});


            console.log("Converting CSV responses to text and parsing...");
            const [eventsText, changesText, inventoryText, servicePointsText, zoneBasesText] = await Promise.all(responses.map(res => res.text()));
            
            const [parsedEvents, parsedChanges, parsedInventory, parsedServicePoints, parsedZoneBases] = await Promise.all([
                Promise.resolve(processEventsCSV(eventsText)),
                Promise.resolve(processChangeEventsCSV(changesText)),
                Promise.resolve(processInventoryCSV(inventoryText)),
                Promise.resolve(processServicePointsCSV(servicePointsText)),
                Promise.resolve(processZoneBasesCSV(zoneBasesText)),
            ]);

            console.log(`Parsed Events: ${parsedEvents.length}`);
            console.log(`Parsed Changes: ${parsedChanges.length}`);
            console.log(`Parsed Inventory: ${parsedInventory.length}`);
            console.log(`Parsed Service Points: ${parsedServicePoints.length}`);
            console.log(`Parsed Zone Bases: ${parsedZoneBases.length}`);

            const inventoryDataMap = new Map<string, { olcHardwareDir?: string; potenciaNominal?: number }>();
            parsedInventory.forEach(item => {
                if (item.streetlightIdExterno) {
                    inventoryDataMap.set(item.streetlightIdExterno, {
                        olcHardwareDir: item.olcHardwareDir,
                        potenciaNominal: item.potenciaNominal
                    });
                }
            });

            const augmentedEvents = parsedEvents.map(event => {
                const inventoryData = inventoryDataMap.get(event.id);
                return {
                    ...event,
                    olcHardwareDir: inventoryData?.olcHardwareDir,
                    power: inventoryData?.potenciaNominal?.toString(), 
                };
            });
            
            console.log("Storing data in IndexedDB...");
            const tx = db.transaction([LUMINAIRE_EVENTS_STORE, CHANGE_EVENTS_STORE, INVENTORY_STORE, SERVICE_POINTS_STORE, ZONE_BASES_STORE], 'readwrite');
            await Promise.all([
                tx.objectStore(LUMINAIRE_EVENTS_STORE).clear(),
                tx.objectStore(CHANGE_EVENTS_STORE).clear(),
                tx.objectStore(INVENTORY_STORE).clear(),
                tx.objectStore(SERVICE_POINTS_STORE).clear(),
                tx.objectStore(ZONE_BASES_STORE).clear(),
                ...augmentedEvents.map(e => tx.objectStore(LUMINAIRE_EVENTS_STORE).put(e)),
                ...parsedChanges.map(c => tx.objectStore(CHANGE_EVENTS_STORE).put(c)),
                ...parsedInventory.map(i => tx.objectStore(INVENTORY_STORE).put(i)),
                ...parsedServicePoints.map(s => tx.objectStore(SERVICE_POINTS_STORE).put(s)),
                ...parsedZoneBases.map(b => tx.objectStore(ZONE_BASES_STORE).put(b)),
            ]);
            await tx.done;
            console.log("Data stored in IndexedDB.");

            setAllEvents(augmentedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
            setChangeEvents(parsedChanges.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
            setInventory(parsedInventory);
            setServicePoints(parsedServicePoints);
            setZoneBases(parsedZoneBases);
            
            // --- Save Daily Snapshot to Firebase ---
            console.log("Calculating and saving daily historical snapshot...");
            const dailySnapshot = calculateDailySnapshot(augmentedEvents, parsedInventory);
            if(Object.keys(dailySnapshot).length > 0) {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                await fetch(`${FIREBASE_BASE_URL}${FIREBASE_HISTORY_PATH}/${todayStr}.json`, {
                    method: 'PUT',
                    body: JSON.stringify(dailySnapshot),
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log(`Daily snapshot for ${todayStr} saved to Firebase.`);
                // Optimistically update local state for immediate feedback
                setHistoricalData(prev => ({...prev, [todayStr]: dailySnapshot}));
            } else {
                console.log("No data for daily snapshot, skipping save to Firebase.");
            }


        } catch (e: any) {
            console.error("Failed to fetch or process data", e);
            setError(`Error al obtener datos: ${e.message}. Verifique las URLs en Firebase y la configuración de CORS en Google Sheets.`);
        } finally {
            setLoading(false);
            console.log("Data fetching and processing complete.");
        }
    }, []);

    useEffect(() => {
        fetchAndProcessData();
    }, [fetchAndProcessData]);


    return { 
        allEvents, changeEvents, inventory, servicePoints, zoneBases, historicalData,
        loading, error 
    };
};