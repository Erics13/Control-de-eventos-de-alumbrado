
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
const parseCsvRow = (row: string, delimiter: string): string[] => {
    const columns: string[] = [];
    if (!row) return columns;
    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`("([^"]*)"|[^${escapedDelimiter}]*)(${escapedDelimiter}|$)`, 'g');

    let match;
    while ((match = regex.exec(row))) {
        let column = match[2] !== undefined ? match[2] : match[1];
        columns.push(column.trim());
        if (match[3] === '') break;
    }
    return columns;
};

const parseCustomDate = (dateStr: string): Date | null => {
    if (!dateStr || !dateStr.includes('/')) return null;
    const parts = dateStr.split(' ');
    if (parts.length < 2) return null;
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length < 3 || timeParts.length < 2) return null;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    let year = parseInt(dateParts[2], 10);
    if(year < 100) year += 2000;
    
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    
    const date = new Date(year, month, day, hour, minute);
    return isNaN(date.getTime()) ? null : date;
};

const parseSpanishNumber = (numStr: string | undefined): number | undefined => {
    if (!numStr) return undefined;
    const cleanedStr = numStr.trim().replace(/\./g, '').replace(/,/g, '.');
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
        const header = lines[0] || '';
        const rows = lines.slice(1);
        const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';

        const parsedEvents: LuminaireEvent[] = [];
        rows.forEach((row) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            if (columns.length < 14) return;
            const eventDate = parseCustomDate(columns[13]?.trim());
            if (!eventDate) return;
            const uniqueEventId = columns[11]?.trim();
            if (!uniqueEventId) return;
            
            const description = columns[12]?.trim() || '';
            const situacion = columns[8]?.trim() || '';
            const situacionLower = situacion.toLowerCase();
            let isSpecialFailure = false;
            let specialFailureCategory: string | undefined = undefined;
            if (situacionLower === 'columna caida') { specialFailureCategory = 'Columna Caída'; isSpecialFailure = true; }
            else if (situacionLower === 'hurto') { specialFailureCategory = 'Hurto'; isSpecialFailure = true; }
            else if (situacionLower.startsWith('vandalizado')) { specialFailureCategory = 'Vandalizado'; isSpecialFailure = true; }
            
            const category = columns[10]?.trim();
            const translatedCategory = FAILURE_CATEGORY_TRANSLATIONS[category];
            const eventStatus = (category && category.length > 0) || isSpecialFailure ? 'FAILURE' : 'OPERATIONAL';
            const finalFailureCategory = specialFailureCategory || (translatedCategory ? translatedCategory : undefined);
            
            const municipio = columns[0]?.trim() || 'N/A';
            const municipioUpper = municipio.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') return;
            
            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            const lat = parseFloat(columns[5]?.trim().replace(',', '.'));
            const lon = parseFloat(columns[6]?.trim().replace(',', '.'));
            const systemMeasuredPower = parseSpanishNumber(columns[14]?.trim());

            parsedEvents.push({
                uniqueEventId, id: columns[4]?.trim(), olcId: columns[3]?.trim(), power: columns[2]?.trim(),
                date: eventDate, municipio, zone, status: eventStatus, description, failureCategory: finalFailureCategory,
                lat: !isNaN(lat) ? lat : undefined, lon: !isNaN(lon) ? lon : undefined,
                systemMeasuredPower,
            });
        });
        return parsedEvents;
    };

    const processChangeEventsCSV = (text: string): ChangeEvent[] => {
        const lines = text.split('\n');
        const header = lines[0] || '';
        const rows = lines.slice(1);
        const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';
        
        const parsedChangeEvents: ChangeEvent[] = [];
        rows.forEach((row) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            if (columns.length < 12) return;
            const fechaRetiro = parseCustomDate(columns[0]?.trim());
            if (!fechaRetiro) return;
            const poleIdExterno = columns[2]?.trim();
            if (!poleIdExterno) return;
            
            const municipio = columns[5]?.trim() || 'N/A';
            const municipioUpper = municipio.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') return;

            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            const lat = parseFloat(columns[6]?.trim().replace(/"/g, '').replace(',', '.'));
            const lon = parseFloat(columns[7]?.trim().replace(/"/g, '').replace(',', '.'));

            parsedChangeEvents.push({
                uniqueId: `${poleIdExterno}-${fechaRetiro.toISOString()}-${columns[9]?.trim()}`, fechaRetiro,
                condicion: columns[1]?.trim(), poleIdExterno,
                horasFuncionamiento: parseSpanishNumber(columns[3]?.trim()) ?? 0,
                recuentoConmutacion: parseSpanishNumber(columns[4]?.trim()) ?? 0,
                municipio, zone, lat: !isNaN(lat) ? lat : undefined, lon: !isNaN(lon) ? lon : undefined,
                streetlightIdExterno: columns[8]?.trim(), componente: columns[9]?.trim(),
                designacionTipo: columns[10]?.trim(), cabinetIdExterno: columns[11]?.trim(),
            });
        });
        return parsedChangeEvents;
    };

    const processInventoryCSV = (text: string): InventoryItem[] => {
        const lines = text.split('\n');
        const header = lines[0] || '';
        const rows = lines.slice(1);
        const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';

        const parsedItems: InventoryItem[] = [];
        rows.forEach((row) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            if (columns.length < 24) return;
            const streetlightIdExterno = columns[1]?.trim();
            if (!streetlightIdExterno) return;

            const municipio = columns[0]?.trim() || 'N/A';
            const municipioUpper = municipio.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') return;

            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            
            const lat = parseFloat(columns[2]?.trim().replace(/"/g, '').replace(',', '.'));
            const lon = parseFloat(columns[3]?.trim().replace(/"/g, '').replace(',', '.'));
            const cabinetLat = parseFloat(columns[20]?.trim().replace(/"/g, '').replace(',', '.'));
            const cabinetLon = parseFloat(columns[21]?.trim().replace(/"/g, '').replace(',', '.'));
            const olcIdExterno = parseInt(columns[15]?.trim(), 10);
            
            parsedItems.push({
                streetlightIdExterno, municipio, zone, lat: !isNaN(lat) ? lat : undefined,
                lon: !isNaN(lon) ? lon : undefined, nroCuenta: columns[4]?.trim(),
                situacion: columns[5]?.trim(), localidad: columns[6]?.trim(),
                fechaInstalacion: parseCustomDate(columns[7]?.trim()) ?? undefined,
                marked: columns[8]?.trim(), estado: columns[9]?.trim(),
                fechaInauguracion: parseCustomDate(columns[10]?.trim()) ?? undefined,
                olcHardwareDir: columns[11]?.trim(), dimmingCalendar: columns[12]?.trim(),
                ultimoInforme: parseCustomDate(columns[13]?.trim()) ?? undefined,
                olcIdExterno: !isNaN(olcIdExterno) ? olcIdExterno : undefined,
                luminaireIdExterno: columns[16]?.trim(),
                horasFuncionamiento: parseSpanishNumber(columns[17]),
                recuentoConmutacion: parseSpanishNumber(columns[18]),
                cabinetIdExterno: columns[19]?.trim(),
                cabinetLat: !isNaN(cabinetLat) ? cabinetLat : undefined,
                cabinetLon: !isNaN(cabinetLon) ? cabinetLon : undefined,
                potenciaNominal: parseSpanishNumber(columns[22]),
                designacionTipo: columns[23]?.trim(),
            });
        });
        return parsedItems;
    };

    const processServicePointsCSV = (text: string): ServicePoint[] => {
        const lines = text.split('\n');
        const header = lines[0] || '';
        const rows = lines.slice(1);
        const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';
        const parsedItems: ServicePoint[] = [];

        rows.forEach((row) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row, delimiter);
            if (columns.length < 9) return;
            const nroCuenta = columns[0]?.trim();
            if (!nroCuenta) return;

            const lat = parseFloat(columns[7]?.trim().replace(',', '.'));
            const lon = parseFloat(columns[8]?.trim().replace(',', '.'));
            if (isNaN(lat) || isNaN(lon)) return;

            parsedItems.push({
                nroCuenta,
                tarifa: columns[1]?.trim(),
                potenciaContratada: parseSpanishNumber(columns[2]) ?? 0,
                tension: columns[3]?.trim(),
                fases: columns[4]?.trim(),
                cantidadLuminarias: parseSpanishNumber(columns[5]) ?? 0,
                direccion: columns[6]?.trim(),
                lat,
                lon,
            });
        });
        return parsedItems;
    };

    const processZoneBasesCSV = (text: string): ZoneBase[] => {
        const lines = text.split('\n');
        const header = lines[0] || '';
        const rows = lines.slice(1);
        const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';

        const parsedItems: ZoneBase[] = [];
        rows.forEach((row) => {
            if (row.trim() === '') return;
            const columns = parseCsvRow(row.trim(), delimiter);
            if (columns.length < 3) return;

            const zoneName = columns[0]?.trim().toUpperCase();
            if (!zoneName) return;

            const lat = parseFloat(columns[1]?.trim().replace(',', '.'));
            const lon = parseFloat(columns[2]?.trim().replace(',', '.'));
            
            if (!isNaN(lat) && !isNaN(lon)) {
                 parsedItems.push({ zoneName, lat, lon });
            }
        });
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
            const firebaseResponse = await fetch(FIREBASE_BASE_URL + FIREBASE_URLS_PATH);
            if (!firebaseResponse.ok) {
                throw new Error(`Error al conectar con Firebase: ${firebaseResponse.statusText}`);
            }
            const data = await firebaseResponse.json();
            if (!data || !data.events || !data.changes || !data.inventory || !data.servicePoints || !data.zoneBases) {
                throw new Error("La configuración de URLs en Firebase es inválida o no se encontró.");
            }
            urls = data as DataSourceURLs;
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
                    fetch(FIREBASE_BASE_URL + FIREBASE_HISTORY_PATH + '.json').then(res => res.json())
                ]);
                setAllEvents(cachedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
                setChangeEvents(cachedChanges.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
                setInventory(cachedInventory);
                setServicePoints(cachedServicePoints);
                setZoneBases(cachedZoneBases);
                setHistoricalData(cachedHistory || {});
                 if (cachedEvents.length === 0 && cachedChanges.length === 0 && cachedInventory.length === 0) {
                    setError(`No se pudo obtener la configuración de Firebase: ${e.message}. No hay datos en la caché.`);
                }
            } catch (dbError) {
                console.error("Error loading from DB/Firebase after Firebase failure:", dbError);
                setError(`No se pudo obtener la configuración de Firebase y también falló la carga desde la caché.`);
            } finally {
                setLoading(false);
            }
            return;
        }

        try {
            const [
                responses,
                historicalDataResponse
            ] = await Promise.all([
                Promise.all([
                    fetch(urls.events).catch(e => { throw new Error(`Eventos: ${e.message}`); }),
                    fetch(urls.changes).catch(e => { throw new Error(`Cambios: ${e.message}`); }),
                    fetch(urls.inventory).catch(e => { throw new Error(`Inventario: ${e.message}`); }),
                    fetch(urls.servicePoints).catch(e => { throw new Error(`Puntos de Servicio: ${e.message}`); }),
                    fetch(urls.zoneBases).catch(e => { throw new Error(`Bases de Zona: ${e.message}`); }),
                ]),
                fetch(FIREBASE_BASE_URL + FIREBASE_HISTORY_PATH + '.json').catch(e => { throw new Error(`Historial: ${e.message}`); })
            ]);


            for (const res of responses) {
                if (!res.ok) throw new Error(`Error al cargar ${res.url}: ${res.statusText}`);
            }
             if (!historicalDataResponse.ok) {
                console.warn(`Could not fetch historical data: ${historicalDataResponse.statusText}. Proceeding without it.`);
                setHistoricalData({});
            } else {
                const history = await historicalDataResponse.json();
                setHistoricalData(history || {});
            }

            const [eventsText, changesText, inventoryText, servicePointsText, zoneBasesText] = await Promise.all(responses.map(res => res.text()));
            
            const [parsedEvents, parsedChanges, parsedInventory, parsedServicePoints, parsedZoneBases] = await Promise.all([
                Promise.resolve(processEventsCSV(eventsText)),
                Promise.resolve(processChangeEventsCSV(changesText)),
                Promise.resolve(processInventoryCSV(inventoryText)),
                Promise.resolve(processServicePointsCSV(servicePointsText)),
                Promise.resolve(processZoneBasesCSV(zoneBasesText)),
            ]);

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

            setAllEvents(augmentedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
            setChangeEvents(parsedChanges.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
            setInventory(parsedInventory);
            setServicePoints(parsedServicePoints);
            setZoneBases(parsedZoneBases);
            
            // --- Save Daily Snapshot to Firebase ---
            const dailySnapshot = calculateDailySnapshot(augmentedEvents, parsedInventory);
            if(Object.keys(dailySnapshot).length > 0) {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                await fetch(`${FIREBASE_BASE_URL}${FIREBASE_HISTORY_PATH}/${todayStr}.json`, {
                    method: 'PUT',
                    body: JSON.stringify(dailySnapshot),
                    headers: { 'Content-Type': 'application/json' }
                });
                // Optimistically update local state for immediate feedback
                setHistoricalData(prev => ({...prev, [todayStr]: dailySnapshot}));
            }


        } catch (e: any) {
            console.error("Failed to fetch or process data", e);
            setError(`Error al obtener datos: ${e.message}. Verifique las URLs en Firebase y la configuración de CORS en Google Sheets.`);
        } finally {
            setLoading(false);
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
