import { useState, useEffect, useCallback } from 'react';
import { openDB, DBSchema, IDBPDatabase, deleteDB } from 'idb';
import type { LuminaireEvent, ChangeEvent, InventoryItem } from '../types';
import { MUNICIPIO_TO_ZONE_MAP, FAILURE_CATEGORY_TRANSLATIONS } from '../constants';
import { parse } from 'date-fns/parse';

// --- IndexedDB Logic ---
const DB_NAME = 'LuminaireDataDB';
const DB_VERSION = 4;
const LUMINAIRE_EVENTS_STORE = 'luminaireEvents';
const CHANGE_EVENTS_STORE = 'changeEvents';
const INVENTORY_STORE = 'inventory'; 
const METADATA_STORE = 'metadata';

interface LuminaireDB extends DBSchema {
  [LUMINAIRE_EVENTS_STORE]: {
    key: string;
    value: LuminaireEvent;
    indexes: { date: Date; sourceFile: string; };
  };
  [CHANGE_EVENTS_STORE]: {
    key: string;
    value: ChangeEvent;
    indexes: { fechaRetiro: Date; sourceFile: string; };
  };
  [INVENTORY_STORE]: {
    key: string;
    value: InventoryItem;
    indexes: { municipio: string; sourceFile: string; };
  };
  [METADATA_STORE]: {
      key: string;
      value: any;
  }
}

let dbPromise: Promise<IDBPDatabase<LuminaireDB>> | null = null;

const getDb = () => {
    if (!dbPromise) {
        dbPromise = openDB<LuminaireDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (oldVersion < 1) {
                    const luminaireStore = db.createObjectStore(LUMINAIRE_EVENTS_STORE, { keyPath: 'uniqueEventId' });
                    luminaireStore.createIndex('date', 'date');
                    const changeStore = db.createObjectStore(CHANGE_EVENTS_STORE, { keyPath: 'uniqueId' });
                    changeStore.createIndex('fechaRetiro', 'fechaRetiro');
                    db.createObjectStore(METADATA_STORE);
                }
                if (oldVersion < 2) {
                   const inventoryStore = db.createObjectStore(INVENTORY_STORE, { keyPath: 'streetlightIdExterno' });
                   inventoryStore.createIndex('municipio', 'municipio');
                }
                if (oldVersion < 3) {
                   // Previous energy store creation logic removed.
                }
                 if (oldVersion < 4) {
                    const luminaireStore = transaction.objectStore(LUMINAIRE_EVENTS_STORE);
                    if (!luminaireStore.indexNames.contains('sourceFile')) {
                        luminaireStore.createIndex('sourceFile', 'sourceFile');
                    }
                    const changeStore = transaction.objectStore(CHANGE_EVENTS_STORE);
                    if (!changeStore.indexNames.contains('sourceFile')) {
                        changeStore.createIndex('sourceFile', 'sourceFile');
                    }
                    const inventoryStore = transaction.objectStore(INVENTORY_STORE);
                    if (!inventoryStore.indexNames.contains('sourceFile')) {
                        inventoryStore.createIndex('sourceFile', 'sourceFile');
                    }
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

const getMetadata = async (key: string): Promise<any> => {
    const db = await getDb();
    return db.get(METADATA_STORE, key);
}

const setMetadata = async (key: string, value: any): Promise<void> => {
     const db = await getDb();
     await db.put(METADATA_STORE, value, key);
}

const bulkAddOrUpdate = async <T extends string>(storeName: T, items: any[]): Promise<void> => {
    if (items.length === 0) return;
    const db = await getDb();
    const tx = db.transaction(storeName, 'readwrite');
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

// --- React Hook ---
export const useLuminaireData = () => {
    const [allEvents, setAllEvents] = useState<LuminaireEvent[]>([]);
    const [changeEvents, setChangeEvents] = useState<ChangeEvent[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const loadDataFromDb = useCallback(async () => {
        setLoading(true);
        try {
            const [
                luminaireEvents, 
                changeEventsData, 
                inventoryItems, 
                fileNames,
            ] = await Promise.all([
                getAllLuminaireEvents(),
                getAllChangeEvents(),
                getAllInventoryItems(),
                getMetadata('uploadedFileNames'),
            ]);

            setAllEvents(luminaireEvents.reverse());
            setChangeEvents(changeEventsData.reverse());
            setInventory(inventoryItems);
            setUploadedFileNames(fileNames || []);

        } catch (e) {
            console.error("Failed to load data from IndexedDB", e);
            setError("No se pudieron cargar los datos guardados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDataFromDb();
    }, [loadDataFromDb]);

    const addEventsFromCSV = (file: File) => {
        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setError("El archivo CSV está vacío o no se pudo leer.");
                setLoading(false);
                return;
            }

            try {
                const lines = text.split('\n');
                const header = lines[0] || '';
                const rows = lines.slice(1);
                const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';

                const parsedEvents: LuminaireEvent[] = [];
                rows.forEach((row, index) => {
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
                        uniqueEventId,
                        id: columns[4]?.trim(),
                        olcId: columns[3]?.trim(),
                        power: columns[2]?.trim(),
                        date: eventDate,
                        municipio, zone, status: eventStatus, description, failureCategory: finalFailureCategory,
                        lat: !isNaN(lat) ? lat : undefined, lon: !isNaN(lon) ? lon : undefined,
                        sourceFile: file.name,
                    });
                });
                
                const existingEventIds = new Set(allEvents.map(event => event.uniqueEventId));
                const newUniqueEvents = parsedEvents.filter(event => !existingEventIds.has(event.uniqueEventId));

                if (newUniqueEvents.length > 0) {
                    await bulkAddOrUpdate(LUMINAIRE_EVENTS_STORE, newUniqueEvents);
                    setAllEvents(prev => [...prev, ...newUniqueEvents].sort((a,b) => b.date.getTime() - a.date.getTime()));
                }

                if (!uploadedFileNames.includes(file.name)) {
                    const newFileNames = [...uploadedFileNames, file.name].sort();
                    await setMetadata('uploadedFileNames', newFileNames);
                    setUploadedFileNames(newFileNames);
                }
            } catch (parseError) {
                console.error("Error parsing CSV", parseError);
                setError("Error al procesar el archivo CSV. Verifique el formato.");
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = () => { setError("No se pudo leer el archivo."); setLoading(false); };
        reader.readAsText(file, 'UTF-8');
    };
    
    const addChangeEventsFromCSV = (file: File) => {
        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setError("El archivo CSV de cambios está vacío.");
                setLoading(false);
                return;
            }

            try {
                const lines = text.split('\n');
                const header = lines[0] || '';
                const rows = lines.slice(1);
                const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';
                
                const parsedChangeEvents: ChangeEvent[] = [];
                rows.forEach((row, index) => {
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
                        uniqueId: `${poleIdExterno}-${fechaRetiro.toISOString()}-${columns[9]?.trim()}`,
                        fechaRetiro,
                        condicion: columns[1]?.trim(),
                        poleIdExterno,
                        horasFuncionamiento: parseInt(columns[3]?.trim(), 10) || 0,
                        recuentoConmutacion: parseInt(columns[4]?.trim(), 10) || 0,
                        municipio, zone,
                        lat: !isNaN(lat) ? lat : undefined, lon: !isNaN(lon) ? lon : undefined,
                        streetlightIdExterno: columns[8]?.trim(),
                        componente: columns[9]?.trim(),
                        designacionTipo: columns[10]?.trim(),
                        cabinetIdExterno: columns[11]?.trim(),
                        sourceFile: file.name,
                    });
                });
                
                const existingIds = new Set(changeEvents.map(e => e.uniqueId));
                const newUnique = parsedChangeEvents.filter(e => !existingIds.has(e.uniqueId));

                if (newUnique.length > 0) {
                    await bulkAddOrUpdate(CHANGE_EVENTS_STORE, newUnique);
                    setChangeEvents(prev => [...prev, ...newUnique].sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
                }

                if (!uploadedFileNames.includes(file.name)) {
                    const newFileNames = [...uploadedFileNames, file.name].sort();
                    await setMetadata('uploadedFileNames', newFileNames);
                    setUploadedFileNames(newFileNames);
                }
            } catch(err) {
                console.error("Error parsing changes CSV", err);
                setError("Error al procesar el archivo CSV de cambios. Verifique el formato.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const addInventoryFromCSV = (file: File) => {
        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setError("El archivo de inventario CSV está vacío.");
                setLoading(false);
                return;
            }

            try {
                const lines = text.split('\n');
                const header = lines[0] || '';
                const rows = lines.slice(1);
                const delimiter = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';

                const parsedItems: InventoryItem[] = [];
                rows.forEach((row, index) => {
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
                    const horasFuncionamiento = parseInt(columns[17]?.trim().replace(/\./g, ''), 10);
                    const recuentoConmutacion = parseInt(columns[18]?.trim().replace(/\./g, ''), 10);
                    const olcIdExterno = parseInt(columns[15]?.trim(), 10);
                    
                    const potenciaNominalStr = columns[22]?.trim();
                    let potenciaNominal: number | undefined;
                    if (potenciaNominalStr) {
                        const parsedPower = parseFloat(potenciaNominalStr.replace(',', '.'));
                        if (!isNaN(parsedPower)) {
                            potenciaNominal = parsedPower;
                        }
                    }
                    
                    parsedItems.push({
                        streetlightIdExterno,
                        municipio,
                        zone,
                        lat: !isNaN(lat) ? lat : undefined,
                        lon: !isNaN(lon) ? lon : undefined,
                        nroCuenta: columns[4]?.trim(),
                        situacion: columns[5]?.trim(),
                        localidad: columns[6]?.trim(),
                        fechaInstalacion: parseCustomDate(columns[7]?.trim()) ?? undefined,
                        marked: columns[8]?.trim(),
                        estado: columns[9]?.trim(),
                        fechaInauguracion: parseCustomDate(columns[10]?.trim()) ?? undefined,
                        olcHardwareDir: columns[11]?.trim(),
                        dimmingCalendar: columns[12]?.trim(),
                        ultimoInforme: parseCustomDate(columns[13]?.trim()) ?? undefined,
                        olcIdExterno: !isNaN(olcIdExterno) ? olcIdExterno : undefined,
                        luminaireIdExterno: columns[16]?.trim(),
                        horasFuncionamiento: !isNaN(horasFuncionamiento) ? horasFuncionamiento : undefined,
                        recuentoConmutacion: !isNaN(recuentoConmutacion) ? recuentoConmutacion : undefined,
                        cabinetIdExterno: columns[19]?.trim(),
                        cabinetLat: !isNaN(cabinetLat) ? cabinetLat : undefined,
                        cabinetLon: !isNaN(cabinetLon) ? cabinetLon : undefined,
                        potenciaNominal,
                        designacionTipo: columns[23]?.trim(),
                        sourceFile: file.name,
                    });
                });

                await bulkAddOrUpdate(INVENTORY_STORE, parsedItems);
                setInventory(await getAllInventoryItems());

                if (!uploadedFileNames.includes(file.name)) {
                    const newFileNames = [...uploadedFileNames, file.name].sort();
                    await setMetadata('uploadedFileNames', newFileNames);
                    setUploadedFileNames(newFileNames);
                }

            } catch(err) {
                console.error("Error parsing inventory CSV", err);
                setError("Error al procesar el archivo CSV de inventario. Verifique el formato.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const addEventsFromJSON = (file: File) => {
        setLoading(true);
        setError(null);
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) {
                setError("El archivo JSON está vacío.");
                setLoading(false);
                return;
            }

            try {
                const data = JSON.parse(text);
                const luminaireEventsToProcess = data?.luminaireEvents || [];
                const changeEventsToProcess = data?.changeEvents || [];
                const inventoryToProcess = data?.inventory || [];
                const filesToProcess = data?.metadata?.fileNames || [];

                // Reconstruct Date objects from string representations from the JSON file.
                // The spread operator (...d) correctly carries over all other properties, including the original `sourceFile`.
                const parsedLuminaireEvents: LuminaireEvent[] = luminaireEventsToProcess.map((d: any) => ({ ...d, date: new Date(d.date) }));
                const parsedChangeEvents: ChangeEvent[] = changeEventsToProcess.map((d: any) => ({ ...d, fechaRetiro: new Date(d.fechaRetiro) }));
                const parsedInventory: InventoryItem[] = inventoryToProcess.map((d: any) => ({
                    ...d,
                    fechaInstalacion: d.fechaInstalacion ? new Date(d.fechaInstalacion) : undefined,
                    fechaInauguracion: d.fechaInauguracion ? new Date(d.fechaInauguracion) : undefined,
                    ultimoInforme: d.ultimoInforme ? new Date(d.ultimoInforme) : undefined,
                }));
                
                // The JSON backup file itself is not a data source, so don't add its name to the list.
                // Only merge the file names that were part of the backup.
                const newFileNames = Array.from(new Set([...uploadedFileNames, ...filesToProcess])).sort();

                await Promise.all([
                    bulkAddOrUpdate(LUMINAIRE_EVENTS_STORE, parsedLuminaireEvents),
                    bulkAddOrUpdate(CHANGE_EVENTS_STORE, parsedChangeEvents),
                    bulkAddOrUpdate(INVENTORY_STORE, parsedInventory),
                    setMetadata('uploadedFileNames', newFileNames),
                ]);
                
                await loadDataFromDb();

            } catch (parseError: any) {
                console.error("Error parsing JSON", parseError);
                setError(`Error al procesar el archivo JSON: ${parseError.message}`);
            } finally {
                setLoading(false);
            }
        };
        reader.onerror = () => { setError("No se pudo leer el archivo."); setLoading(false); };
        reader.readAsText(file, 'UTF-8');
    };
    
    const downloadDataAsJSON = useCallback(async () => {
        if (allEvents.length === 0 && changeEvents.length === 0 && inventory.length === 0) {
            alert("No hay datos para descargar.");
            return;
        }
        try {
            const dataToDownload = {
                metadata: { 
                    exportDate: new Date().toISOString(), 
                    fileCount: uploadedFileNames.length, 
                    fileNames: uploadedFileNames,
                },
                luminaireEvents: allEvents,
                changeEvents: changeEvents,
                inventory: inventory,
            };
            const jsonString = JSON.stringify(dataToDownload, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `respaldo_alumbrado_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
        } catch (downloadError) {
            console.error("Error creating download file", downloadError);
            setError("No se pudo crear el archivo de respaldo.");
        }
    }, [allEvents, changeEvents, inventory, uploadedFileNames]);
    
    const deleteDataByFileName = useCallback(async (fileName: string) => {
        setLoading(true);
        setError(null);
        try {
            const db = await getDb();
            
            const tx = db.transaction([LUMINAIRE_EVENTS_STORE, CHANGE_EVENTS_STORE, INVENTORY_STORE, METADATA_STORE], 'readwrite');
            
            const stores = [LUMINAIRE_EVENTS_STORE, CHANGE_EVENTS_STORE, INVENTORY_STORE];

            for (const storeName of stores) {
                const store = tx.objectStore(storeName as any);
                const index = store.index('sourceFile');
                let cursor = await index.openCursor(fileName);
                while(cursor) {
                    await cursor.delete();
                    cursor = await cursor.continue();
                }
            }

            const currentFiles = (await getMetadata('uploadedFileNames')) || [];
            const newFiles = currentFiles.filter((f: string) => f !== fileName);
            await tx.objectStore(METADATA_STORE).put(newFiles, 'uploadedFileNames');
            
            await tx.done;

            await loadDataFromDb();

        } catch (err) {
            console.error("Failed to delete data for file:", fileName, err);
            setError(`Error al eliminar los datos del archivo ${fileName}.`);
        } finally {
            setLoading(false);
        }
    }, [loadDataFromDb]);

    const resetApplication = useCallback(async () => {
        if (window.confirm("¿Estás seguro de que quieres borrar todos los datos? Esta acción no se puede deshacer.")) {
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
        uploadedFileNames, 
        addEventsFromCSV, addChangeEventsFromCSV, addInventoryFromCSV, 
        addEventsFromJSON, downloadDataAsJSON, 
        deleteDataByFileName, resetApplication, 
        loading, error 
    };
};