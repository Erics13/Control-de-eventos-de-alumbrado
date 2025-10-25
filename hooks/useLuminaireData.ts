
import { useState, useEffect, useCallback } from 'react';
import { openDB, DBSchema, IDBPDatabase, deleteDB } from 'idb';
import type { LuminaireEvent, ChangeEvent, InventoryItem, DataSourceURLs } from '../types';
import { MUNICIPIO_TO_ZONE_MAP, FAILURE_CATEGORY_TRANSLATIONS } from '../constants';
import { parse } from 'date-fns/parse';

// --- IndexedDB Logic ---
const DB_NAME = 'LuminaireDataDB';
const DB_VERSION = 5;
const LUMINAIRE_EVENTS_STORE = 'luminaireEvents';
const CHANGE_EVENTS_STORE = 'changeEvents';
const INVENTORY_STORE = 'inventory'; 

// --- Firebase Config ---
const FIREBASE_URL = 'https://gestion-de-fallas-default-rtdb.firebaseio.com/dataSourceURLs.json';


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
    indexes: { municipio: string; };
  };
}

let dbPromise: Promise<IDBPDatabase<LuminaireDB>> | null = null;

const getDb = () => {
    if (!dbPromise) {
        dbPromise = openDB<LuminaireDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                if (oldVersion < 5) {
                    if (db.objectStoreNames.contains(LUMINAIRE_EVENTS_STORE)) {
                        db.deleteObjectStore(LUMINAIRE_EVENTS_STORE);
                    }
                    const luminaireStore = db.createObjectStore(LUMINAIRE_EVENTS_STORE, { keyPath: 'uniqueEventId' });
                    luminaireStore.createIndex('date', 'date');

                    if (db.objectStoreNames.contains(CHANGE_EVENTS_STORE)) {
                        db.deleteObjectStore(CHANGE_EVENTS_STORE);
                    }
                    const changeStore = db.createObjectStore(CHANGE_EVENTS_STORE, { keyPath: 'uniqueId' });
                    changeStore.createIndex('fechaRetiro', 'fechaRetiro');

                    if (db.objectStoreNames.contains(INVENTORY_STORE)) {
                        db.deleteObjectStore(INVENTORY_STORE);
                    }
                    const inventoryStore = db.createObjectStore(INVENTORY_STORE, { keyPath: 'streetlightIdExterno' });
                    inventoryStore.createIndex('municipio', 'municipio');
                }
            },
        });
    }
    return dbPromise;
};

const getAllLuminaireEvents = async (): Promise<LuminaireEvent[]> => {
    const db = await getDb();
    return db.getAllFromIndex(LUMINAIRE_EVENTS_STORE, 'date');
};

const getAllChangeEvents = async (): Promise<ChangeEvent[]> => {
    const db = await getDb();
    return db.getAllFromIndex(CHANGE_EVENTS_STORE, 'fechaRetiro');
};

const getAllInventoryItems = async (): Promise<InventoryItem[]> => {
    const db = await getDb();
    return db.getAll(INVENTORY_STORE);
}

const bulkAddOrUpdate = async <T extends string>(storeName: T, items: any[]): Promise<void> => {
    if (items.length === 0) return;
    const db = await getDb();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.store.clear(); 
    await Promise.all(items.map(item => tx.store.put(item)));
    await tx.done;
};

const clearAllData = async (): Promise<void> => {
    if (dbPromise) {
        const db = await dbPromise;
        db.close();
        dbPromise = null;
    }
    await deleteDB(DB_NAME);
};

// --- Helper Functions ---
const parseCsvRow = (row: string, delimiter: string): string[] => {
    const columns: string[] = [];
    if (!row) return columns;
    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`("([^"]*)"|[^${escapedDelimiter}]*)(${escapedDelimiter}|$)`, 'g');

    let match;
    let currentRow = row;
    while ((match = regex.exec(currentRow))) {
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

            parsedEvents.push({
                uniqueEventId, id: columns[4]?.trim(), olcId: columns[3]?.trim(), power: columns[2]?.trim(),
                date: eventDate, municipio, zone, status: eventStatus, description, failureCategory: finalFailureCategory,
                lat: !isNaN(lat) ? lat : undefined, lon: !isNaN(lon) ? lon : undefined,
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

    const fetchAndProcessData = useCallback(async () => {
        setLoading(true);
        setError(null);

        let urls: DataSourceURLs;
        try {
            const firebaseResponse = await fetch(FIREBASE_URL);
            if (!firebaseResponse.ok) {
                throw new Error(`Error al conectar con Firebase: ${firebaseResponse.statusText}`);
            }
            const data = await firebaseResponse.json();
            if (!data || !data.events || !data.changes || !data.inventory) {
                throw new Error("La configuración de URLs en Firebase es inválida o no se encontró.");
            }
            urls = data as DataSourceURLs;
        } catch (e: any) {
            console.error("Failed to fetch URLs from Firebase", e);
            setError(`No se pudo obtener la configuración de Firebase: ${e.message}. Intentando cargar desde la caché...`);
            try {
                const [cachedEvents, cachedChanges, cachedInventory] = await Promise.all([
                    getAllLuminaireEvents(),
                    getAllChangeEvents(),
                    getAllInventoryItems(),
                ]);
                setAllEvents(cachedEvents.reverse());
                setChangeEvents(cachedChanges.reverse());
                setInventory(cachedInventory);
                 if (cachedEvents.length === 0 && cachedChanges.length === 0 && cachedInventory.length === 0) {
                    setError(`No se pudo obtener la configuración de Firebase: ${e.message}. No hay datos en la caché.`);
                }
            } catch (dbError) {
                console.error("Error loading from DB after Firebase failure:", dbError);
                setError(`No se pudo obtener la configuración de Firebase y también falló la carga desde la caché.`);
            } finally {
                setLoading(false);
            }
            return;
        }

        try {
            const responses = await Promise.all([
                fetch(urls.events).catch(e => { throw new Error(`Eventos: ${e.message}`); }),
                fetch(urls.changes).catch(e => { throw new Error(`Cambios: ${e.message}`); }),
                fetch(urls.inventory).catch(e => { throw new Error(`Inventario: ${e.message}`); }),
            ]);

            for (const res of responses) {
                if (!res.ok) throw new Error(`Error al cargar ${res.url}: ${res.statusText}`);
            }

            const [eventsText, changesText, inventoryText] = await Promise.all(responses.map(res => res.text()));
            
            const [parsedEvents, parsedChanges, parsedInventory] = await Promise.all([
                Promise.resolve(processEventsCSV(eventsText)),
                Promise.resolve(processChangeEventsCSV(changesText)),
                Promise.resolve(processInventoryCSV(inventoryText)),
            ]);

            await Promise.all([
                bulkAddOrUpdate(LUMINAIRE_EVENTS_STORE, parsedEvents),
                bulkAddOrUpdate(CHANGE_EVENTS_STORE, parsedChanges),
                bulkAddOrUpdate(INVENTORY_STORE, parsedInventory),
            ]);

            setAllEvents(parsedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
            setChangeEvents(parsedChanges.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
            setInventory(parsedInventory);

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

    const resetApplication = useCallback(async () => {
        if (window.confirm("¿Estás seguro de que quieres borrar todos los datos locales en caché? Esta acción no se puede deshacer. Los datos se volverán a cargar desde la nube.")) {
            setLoading(true);
            try {
                await clearAllData();
                window.location.reload();
            } catch (e) {
                 console.error("Fallo al intentar reiniciar la aplicación", e);
                 setError("Error al intentar reiniciar la aplicación.");
                 setLoading(false);
            }
        }
    }, []);

    return { 
        allEvents, changeEvents, inventory, 
        resetApplication, 
        loading, error 
    };
};
