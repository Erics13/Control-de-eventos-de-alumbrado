
import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { LuminaireEvent, ChangeEvent, InventoryItem, DataSourceURLs, HistoricalData, HistoricalZoneData, ServicePoint, ZoneBase } from '../types';
import { MUNICIPIO_TO_ZONE_MAP, FAILURE_CATEGORY_TRANSLATIONS, ZONE_ORDER } from '../constants';
import { format } from 'date-fns/format';
import { normalizeString } from '../utils/string';


// --- IndexedDB Logic ---
const DB_NAME = 'LuminaireDataDB';
const DB_VERSION = 10; // Increment version for schema changes
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
            upgrade(db, oldVersion, newVersion, transaction) {
                console.log(`Upgrading DB from version ${oldVersion} to ${newVersion}`);
                if (oldVersion < 10) { // Example: If previous version didn't have all stores
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
                }
                // Add migration logic for future versions here if schema changes
            },
        });
    }
    return dbPromise;
};

// --- Helper Functions ---
const detectDelimiter = (header: string): string => {
    const commaCount = (header.match(/,/g) || []).length;
    const semicolonCount = (header.match(/;/g) || []).length;
    const tabCount = (header.match(/\t/g) || []).length;

    if (tabCount > commaCount && tabCount > semicolonCount) return '\t';
    if (semicolonCount > commaCount) return ';';
    return ',';
};

const parseCsvRow = (row: string, delimiter: string): string[] => {
    const columns: string[] = [];
    if (!row) return columns;
    const escapedDelimiter = delimiter.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Regex to handle quoted fields containing delimiters and escaped quotes
    // (?:...|) non-capturing group for quoted or non-quoted content
    // "((?:[^"]|"")*)" captures content inside double quotes, handling "" as "
    // |([^DELIMITER]*) captures content without quotes until delimiter
    const regex = new RegExp(`(?:"((?:[^"]|"")*)"|([^${escapedDelimiter}]*))(${escapedDelimiter}|$)`, 'g');

    let match;
    while ((match = regex.exec(row))) {
        // Use match[1] for quoted content, match[2] for non-quoted content
        let column = match[1] !== undefined ? match[1].replace(/""/g, '"') : (match[2] || '');
        columns.push(column.trim());
        if (match[3] === '' && match[0] !== delimiter) break; // Break if at end of row and not just an empty field
    }
    return columns;
};

// Map of common header names to a standardized internal key
interface HeaderMap {
    [key: string]: string;
}

const normalizeHeader = (header: string): string => {
    // Apply initial normalization (lowercase, no accents, trim)
    let normalized = normalizeString(header);

    // --- Specific replacements for known prefixed headers (e.g., from Interact software) ---
    // These should come first to catch exact matches for common prefixed headers
    normalized = normalized
        // Event related
        .replace(/^event\/event time$/, 'fecha_reporte')
        .replace(/^event\/failure category$/, 'categoria_falla')
        .replace(/^event\/description$/, 'descripcion_falla')
        .replace(/^event\/system measured power$/, 'potencia_medida') // Maps to systemMeasuredPower
        .replace(/^event\/event monitor id$/, 'olc_id') // Maps to olcId
        // NEW Event monitor/ headers
        .replace(/^event monitor\/estado$/, 'status')
        .replace(/^event monitor\/categoría$/, 'categoria_falla') // Specific: handle 'categoría' with accent
        .replace(/^event monitor\/categoria$/, 'categoria_falla')
        .replace(/^event monitor\/id$/, 'olc_id')
        .replace(/^event monitor\/mensaje de error$/, 'descripcion_falla')
        .replace(/^event monitor\/informado por primera vez el$/, 'fecha_reporte')
        .replace(/^event monitor\/potencia medida del sistema$/, 'potencia_medida')
        .replace(/^event monitor\/voltaje$/, 'voltaje')
        .replace(/^event monitor\/informado por ultima vez el$/, 'ultimo_informe')


        // Streetlight related (applies to Events & Inventory)
        .replace(/^streetlight\/id externo$/, 'id_luminaria') // Maps to id or streetlightIdExterno
        .replace(/^streetlight\/municipio$/, 'municipio')
        .replace(/^streetlight\/situación$/, 'situacion') // Specific: handle 'situación' with accent
        .replace(/^streetlight\/situacion$/, 'situacion')
        .replace(/^streetlight\/latitud$/, 'lat') // Specific: handle 'latitud' with accent
        .replace(/^streetlight\/longitud$/, 'lon') // Specific: handle 'longitud' with accent
        .replace(/^streetlight\/nominal power$/, 'potencia_nominal') // Maps to power or potenciaNominal
        .replace(/^streetlight\/olc hardware direction$/, 'olc_hardware_dir') // Maps to olcHardwareDir
        .replace(/^streetlight\/cabinet external id$/, 'id_gabinete') // Maps to cabinetIdExterno
        .replace(/^streetlight\/marked$/, 'marked') // Maps to marked
        .replace(/^streetlight\/localidad$/, 'localidad') // Maps to localidad
        .replace(/^streetlight\/estado$/, 'estado') // Maps to estado
        .replace(/^streetlight\/fecha de instalación$/, 'fecha_instalacion') // Specific: handle 'instalación' with accent
        .replace(/^streetlight\/fecha de instalacion$/, 'fecha_instalacion')
        .replace(/^streetlight\/fecha inauguración$/, 'fecha_inauguracion') // Specific: handle 'inauguración' with accent
        .replace(/^streetlight\/fecha inauguracion$/, 'fecha_inauguracion')
        .replace(/^streetlight\/dimming calendar$/, 'dimming_calendar') // Maps to dimmingCalendar
        .replace(/^olc\/dimming calendar name$/, 'dimming_calendar') // NEW: Maps OLC/Dimming calendar name to dimmingCalendar
        .replace(/^streetlight\/hora del ultimo informe$/, 'ultimo_informe') // Specific: handle 'último' with accent
        .replace(/^streetlight\/hora del ultimo informe$/, 'ultimo_informe')
        .replace(/^streetlight\/olc external id$/, 'olc_id_externo') // Maps to olcIdExterno
        .replace(/^streetlight\/luminaire external id$/, 'luminaire_id_externo') // Maps to luminaireIdExterno
        .replace(/^streetlight\/horas de funcionamiento$/, 'horas_funcionamiento')
        .replace(/^streetlight\/recuento de conmutación$/, 'recuento_conmutacion') // Specific: handle 'conmutación' with accent
        .replace(/^streetlight\/recuento de conmutacion$/, 'recuento_conmutacion')
        .replace(/^streetlight\/cabinet latitude$/, 'cabinet_lat') // Maps to cabinetLat
        .replace(/^streetlight\/cabinet longitude$/, 'cabinet_lon') // Maps to cabinetLon
        .replace(/^streetlight\/type designation$/, 'designacion_tipo') // Maps to designacionTipo
        // NEW streetlight/nro_cuenta header
        .replace(/^streetlight\/nro_cuenta$/, 'nro_cuenta')

        // Change event specific (if prefixed)
        .replace(/^change\/fecha de retiro$/, 'fecha_retiro')
        .replace(/^change\/pole id externo$/, 'pole_id_externo')
        .replace(/^change\/componente$/, 'componente')
        .replace(/^change\/condición$/, 'condicion') // Specific: handle 'condición' with accent
        .replace(/^change\/condicion$/, 'condicion')
        // NEW Pole/ headers
        .replace(/^pole\/fecha de retiro$/, 'fecha_retiro')
        .replace(/^pole\/condición$/, 'condicion') // Specific: handle 'condición' with accent
        .replace(/^pole\/condicion$/, 'condicion')
        .replace(/^pole\/id externo$/, 'pole_id_externo')
        .replace(/^pole\/horas de funcionamiento$/, 'horas_funcionamiento')
        .replace(/^pole\/recuento de conmutacion$/, 'recuento_conmutacion')
        // NEW Pole type/ headers
        .replace(/^pole type\/componente$/, 'componente')
        .replace(/^pole type\/designación de tipo$/, 'designacion_tipo') // Specific: handle 'designación' with accent
        .replace(/^pole type\/designacion de tipo$/, 'designacion_tipo')

        // Service Point specific (if prefixed)
        .replace(/^servicepoint\/nro cuenta$/, 'nro_cuenta')
        .replace(/^servicepoint\/tarifa$/, 'tarifa')
        .replace(/^servicepoint\/potencia contratada$/, 'potencia_contratada')
        // NEW: specific replacement for 'potcontrat' to 'potencia_contratada'
        .replace(/^potcontrat$/, 'potencia_contratada')
        .replace(/^servicepoint\/tension$/, 'tension')
        .replace(/^servicepoint\/fases$/, 'fases')
        .replace(/^servicepoint\/direccion$/, 'direccion')
        .replace(/^servicepoint\/alcid$/, 'alcid')
        .replace(/^servicepoint\/porcent ef$/, 'porcent_ef')
        .replace(/^servicepoint\/point x$/, 'lon')
        .replace(/^servicepoint\/point y$/, 'lat')
        .replace(/^servicepoint\/zona$/, 'zone_name') // FIX: Mapping 'zona' to 'zone_name' for ServicePoints.

        // Zone Base specific (if prefixed)
        .replace(/^zone\/name$/, 'zone_name')
        .replace(/^zone\/latitude$/, 'lat')
        .replace(/^zone\/longitude$/, 'lon')

        // NEW Luminaire/ specific headers (distinct from 'streetlight/')
        .replace(/^luminaire\/id externo$/, 'luminaire_id_externo')
        .replace(/^luminaire\/horas de funcionamiento de la lámpara$/, 'horas_funcionamiento') // Specific: handle 'lámpara' with accent
        .replace(/^luminaire\/horas de funcionamiento de la lampara$/, 'horas_funcionamiento')
        .replace(/^luminaire\/recuento de conmutación de la lámpara$/, 'recuento_conmutacion') // Specific: handle 'conmutación' and 'lámpara' with accents
        .replace(/^luminaire\/recuento de conmutacion de la lampara$/, 'recuento_conmutacion')

        // NEW Luminaire type/ specific headers
        .replace(/^luminaire type\/potencia nominal$/, 'potencia_nominal')
        .replace(/^luminaire type\/designación de tipo$/, 'designacion_tipo') // Specific: handle 'designación' with accent
        .replace(/^luminaire type\/designacion de tipo$/, 'designacion_tipo')

        // Cabinet/ specific headers
        .replace(/^cabinet\/id externo$/, 'cabinetIdExterno') // Mapped to cabinetIdExterno (as in InventoryItem type)
        .replace(/^cabinet\/latitud$/, 'cabinet_lat')
        .replace(/^cabinet\/longitud$/, 'cabinet_lon')
        
        // **NEW FIX**: Specifically target OLC Hardware Address with exact wording variations from CSV
        .replace(/^olc\/dirección de hardware$/, 'olc_hardware_dir')
        .replace(/^olc\/direccion de hardware$/, 'olc_hardware_dir')
        .replace(/^olc hardware direction$/, 'olc_hardware_dir')
    ;

    // --- Generic replacements (less specific, should come after specific ones) ---
    // These catch headers that don't have prefixes or have slightly different wording
    normalized = normalized
        .replace(/id_externo_luminaria|id_luminaria_externo|id_de_luminaria|streetlightidexterno|event_monitor_id/g, 'id_luminaria')
        .replace(/event_monitor_c/g, 'categoria_falla')
        .replace(/event_monitor_d/g, 'descripcion_falla')
        .replace(/event_monitor_s/g, 'situacion')
        .replace(/id_gabinete_externo|id_de_gabinete|cabinetidexterno/g, 'id_gabinete') // Generic to id_gabinete, will be remapped to cabinetIdExterno by specific rule above if present
        .replace(/numero_de_cuenta|num_cuenta/g, 'nro_cuenta')
        .replace(/potencia_nominal_w|potencia_nominal_w_v/g, 'potencia_nominal')
        .replace(/latitud|latitude/g, 'lat')
        .replace(/longitud|longitude/g, 'lon')
        .replace(/fecha_de_reporte|event_time|date/g, 'fecha_reporte')
        .replace(/fecha_de_retiro/g, 'fecha_retiro')
        .replace(/horas_de_funcionamiento_de_la_lampara/g, 'horas_funcionamiento')
        .replace(/recuento_de_conmutacion/g, 'recuento_conmutacion')
        // General match for olc hardware dir
        .replace(/direccion_de_hardware_olc/g, 'olc_hardware_dir')
        .replace(/olc_hardware_dir/g, 'olc_hardware_dir')
        
        .replace(/situacion_de_la_luminaria/g, 'situacion')
        .replace(/categoria_de_falla|category/g, 'categoria_falla')
        .replace(/descripcion_de_falla|description/g, 'descripcion_falla')
        .replace(/municipio/g, 'municipio')
        .replace(/pole_id_externo/g, 'pole_id_externo')
        .replace(/olc_id_externo/g, 'olc_id_externo')
        .replace(/componente/g, 'componente')
        .replace(/condicion/g, 'condicion')
        .replace(/designacion_de_tipo/g, 'designacion_tipo')
        .replace(/tarifa/g, 'tarifa')
        .replace(/potencia_contratada_kw/g, 'potencia_contratada')
        .replace(/tension/g, 'tension')
        .replace(/fases/g, 'fases')
        .replace(/alcid/g, 'alcid')
        .replace(/porcent_ef/g, 'porcent_ef')
        .replace(/point_x/g, 'lon')
        .replace(/point_y/g, 'lat')
        .replace(/zona/g, 'zone_name') // Generic for 'zona' -> 'zone_name'
        .replace(/^zonename$/, 'zone_name') // NEW: Map "zonename" (normalized "zoneName") to "zone_name"
        .replace(/estado/g, 'estado')
        .replace(/systemmeasuredpower/g, 'potencia_medida')
        .replace(/dimmingcalendar/g, 'dimming_calendar')
        // General numeric headers that may need specific mapping
        .replace(/nro_cuenta/g, 'nro_cuenta');
    
    return normalized;
};

// FIX: Defined the `getHeaderMap` function to correctly parse CSV headers into a normalized map.
const getHeaderMap = (headers: string[]): HeaderMap => {
    const headerMap: HeaderMap = {};
    headers.forEach((header, index) => {
        const normalized = normalizeHeader(header);
        // Store the index as a string for consistent lookup.
        headerMap[normalized] = index.toString();
    });
    return headerMap;
};

const getColumnValue = (columns: string[], headerMap: HeaderMap, key: string): string | undefined => {
    const indexStr = headerMap[key];
    if (indexStr !== undefined) {
        const index = parseInt(indexStr, 10);
        // Ensure index is within bounds of columns array
        if (index >= 0 && index < columns.length) {
            return columns[index];
        }
    }
    return undefined;
};


const parseCustomDate = (dateStr: string | undefined): Date | null => {
    if (!dateStr || dateStr.trim() === '') return null;
    const trimmedStr = dateStr.trim();

    // 1. Try 'DD/MM/YYYY HH:MM' or 'D/M/YYYY HH:MM' (common in Spanish CSVs)
    let match = trimmedStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s(\d{1,2}):(\d{1,2})$/);
    if (match) {
        const [, day, month, year, hour, minute] = match.map(Number);
        const fullYear = year < 100 ? year + 2000 : year; // Handle 2-digit years
        const date = new Date(fullYear, month - 1, day, hour, minute);
        return isNaN(date.getTime()) ? null : date;
    }

    // 2. Try 'DD/MM/YYYY' (date only)
    match = trimmedStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
        const [, day, month, year] = match.map(Number);
        const fullYear = year < 100 ? year + 2000 : year; // Handle 2-digit years
        const date = new Date(fullYear, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
    }

    // 3. Try 'YYYY-MM-DD HH:MM:SS' or 'YYYY-MM-DD HH:MM' (common in exports)
    match = trimmedStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (match) {
        const [, year, month, day, hour, minute, second] = match.map(Number);
        const date = new Date(year, month - 1, day, hour, minute, second || 0);
        return isNaN(date.getTime()) ? null : date;
    }
    
    // 4. Try 'YYYY-MM-DD' (date only)
    match = trimmedStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
        const [, year, month, day] = match.map(Number);
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
    }

    // 5. Fallback for ISO format or other standard formats
    try {
        const date = new Date(trimmedStr);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
};

const parseNumberFromCSV = (numStr: string | undefined): number | undefined => {
    if (!numStr || numStr.trim() === '' || numStr.toLowerCase().trim() === 'n/a' || numStr.toLowerCase().trim() === '-') return undefined;
    
    let cleanedStr = numStr.trim();
    
    // Remove all whitespace
    cleanedStr = cleanedStr.replace(/\s/g, '');

    // Heuristic: If both '.' and ',' are present, assume '.' is thousands separator and ',' is decimal.
    // If only ',' is present, assume it's the decimal separator.
    // Otherwise, assume '.' is decimal separator or no decimal.
    if (cleanedStr.includes('.') && cleanedStr.includes(',')) {
        // Example: "1.234,56" -> remove dots, replace comma with dot
        if (cleanedStr.indexOf(',') > cleanedStr.indexOf('.')) { // Likely European format
            cleanedStr = cleanedStr.replace(/\./g, '').replace(',', '.');
        } else { // Likely American format, e.g., "1,234.56" -> remove commas
            cleanedStr = cleanedStr.replace(/,/g, '');
        }
    } else if (cleanedStr.includes(',')) {
        // Example: "1234,56" -> replace comma with dot
        cleanedStr = cleanedStr.replace(',', '.');
    }
    // If only dots, or no separators, parseFloat will handle it.
    // Example: "123.45" -> parseFloat("123.45") is fine
    // Example: "123" -> parseFloat("123") is fine

    const parsed = parseFloat(cleanedStr);
    return isNaN(parsed) ? undefined : parsed;
};

// **NEW Helper**: Specialized parser for fields expected to be large integers (like operating hours)
// which might be formatted with dots as thousand separators (e.g., 12.345 meaning 12,345).
const parseIntegerLikeField = (numStr: string | undefined): number | undefined => {
    if (!numStr || numStr.trim() === '' || numStr.toLowerCase().trim() === 'n/a' || numStr.toLowerCase().trim() === '-') return undefined;
    
    let cleaned = numStr.trim();
    
    // Check if it's using dots as thousand separators without commas (e.g. 12.345 meaning 12345)
    // This is common in Spanish locale CSVs where decimals would be commas.
    // We strictly apply this for fields that are conceptually counters/integers.
    if (cleaned.includes('.') && !cleaned.includes(',')) {
        cleaned = cleaned.replace(/\./g, '');
    }
    
    // Use the standard parser for the rest (handling commas as decimals, etc.)
    return parseNumberFromCSV(cleaned);
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

    // Threshold for detailed vs. summary warnings for skipped rows
    const SKIPPED_ROW_WARNING_THRESHOLD = 5; // Reduced threshold for more details on initial rows

    const processEventsCSV = (text: string): LuminaireEvent[] => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return [];
        const delimiter = detectDelimiter(lines[0]);
        const headerRow = parseCsvRow(lines[0], delimiter);
        const headerMap = getHeaderMap(headerRow);
        // console.log("Events Delimiter:", delimiter, "Header Map:", JSON.stringify(headerMap, null, 2)); // Depuración: Desactivado

        const parsedEvents: LuminaireEvent[] = [];
        let skippedRowsCount = 0;
        const firstSkippedRowsDetails: { rowIndex: number; missing: string; columns: string[] }[] = [];

        lines.slice(1).forEach((row, rowIndex) => {
            const columns = parseCsvRow(row, delimiter);

            const getVal = (key: string) => getColumnValue(columns, headerMap, key);
            
            const eventDateStrRaw = getVal('fecha_reporte');
            const idRaw = getVal('id_luminaria');
            let municipioRaw = getVal('municipio'); // Use let to allow modification
            const situacionRaw = getVal('situacion');
            const categoryRaw = getVal('categoria_falla');
            const description = getVal('descripcion_falla');
            const latRaw = getVal('lat');
            const lonRaw = getVal('lon');
            const statusRaw = getVal('status');
            const nroCuentaRaw = getVal('nro_cuenta'); // Get nroCuenta

            const lat = parseNumberFromCSV(latRaw);
            const lon = parseNumberFromCSV(lonRaw);

            const missingDetails: string[] = [];
            if (!idRaw) missingDetails.push(`id_luminaria (valor: '${idRaw}')`);
            if (!eventDateStrRaw) missingDetails.push(`fecha_reporte (valor: '${eventDateStrRaw}')`);
            if (lat === undefined) missingDetails.push(`lat (valor: '${latRaw}')`);
            if (lon === undefined) missingDetails.push(`lon (valor: '${lonRaw}')`);

            // Gracefully handle empty municipio by assigning 'Desconocido'
            let finalMunicipio = municipioRaw;
            if (!municipioRaw || municipioRaw.trim() === '') {
                finalMunicipio = 'Desconocido';
            }

            // After attempting to parse and assign default for municipio, check if critical data is still missing
            if (missingDetails.length > 0) {
                skippedRowsCount++;
                if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                     firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: missingDetails.join(', '), columns: columns });
                }
                return;
            }
            const eventDate = parseCustomDate(eventDateStrRaw);
            if (!eventDate) {
                 skippedRowsCount++;
                 if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: `fecha inválida '${eventDateStrRaw}'`, columns: columns });
                 }
                 return;
            }

            const municipioUpper = finalMunicipio!.toUpperCase(); // Use finalMunicipio
            // FIX: Removed exclusion logic for specific municipalities in Events.
            // if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') {
            //     skippedRowsCount++;
            //     if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
            //         firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: `municipio excluido '${finalMunicipio}'`, columns: columns });
            //     }
            //     return;
            // }
            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            
            const situacionLower = situacionRaw ? situacionRaw.toLowerCase() : undefined;
            let specialFailureCategory: string | undefined = undefined;
            if (situacionLower && situacionLower.includes('columna') && situacionLower.includes('caida')) { specialFailureCategory = 'Columna Caída'; }
            else if (situacionLower && situacionLower.includes('hurto')) { specialFailureCategory = 'Hurto'; }
            else if (situacionLower && (situacionLower.includes('vandalizad') || situacionLower.includes('vandalism'))) { specialFailureCategory = 'Vandalizado'; }
            
            const translatedCategory = categoryRaw ? FAILURE_CATEGORY_TRANSLATIONS[categoryRaw!] : undefined;
            const finalFailureCategory = (translatedCategory && translatedCategory !== 'N/A' ? translatedCategory : undefined) || specialFailureCategory;
            const eventStatus = (finalFailureCategory || statusRaw === 'FAILURE') ? 'FAILURE' : 'OPERATIONAL';


            const parsedEvent: LuminaireEvent = {
                uniqueEventId: `${idRaw!}-${eventDate.getTime()}-${finalFailureCategory || 'NA'}`, // Ensure unique ID
                id: idRaw!, 
                olcId: getVal('olc_id'), 
                power: getVal('potencia_nominal'), // Use the normalized header
                date: eventDate, 
                municipio: finalMunicipio!, // Use finalMunicipio
                zone: zone, 
                status: eventStatus, 
                description: description || 'N/A', 
                failureCategory: finalFailureCategory,
                lat: lat, 
                lon: lon,
                olcHardwareDir: getVal('olc_hardware_dir'), // Updated by normalizeHeader to catch "OLC/Dirección de hardware"
                systemMeasuredPower: parseNumberFromCSV(getVal('potencia_medida')),
                situacion: situacionLower,
                nroCuenta: nroCuentaRaw, // Add nroCuenta to event
            };
            parsedEvents.push(parsedEvent);
            // if (parsedEvents.length <= 5) { // Depuración: Log de las primeras 5 filas procesadas
            //     console.log("Events: Parsed Event (first 5 rows):", parsedEvent);
            // }
        });

        if (skippedRowsCount > 0) {
            console.warn(`Eventos: Se omitieron ${skippedRowsCount} filas en total. ${firstSkippedRowsDetails.length} detalles de las primeras filas omitidas:`);
            firstSkippedRowsDetails.forEach(detail => {
                console.warn(`  - Fila ${detail.rowIndex}: Faltante/Inválido: ${detail.missing}. Columnas crudas:`, detail.columns, 'Header Map:', JSON.stringify(headerMap, null, 2));
            });
        }
        return parsedEvents;
    };

    const processChangeEventsCSV = (text: string): ChangeEvent[] => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return [];
        const delimiter = detectDelimiter(lines[0]);
        const headerRow = parseCsvRow(lines[0], delimiter);
        const headerMap = getHeaderMap(headerRow);
        // console.log("Change Events Delimiter:", delimiter, "Header Map:", JSON.stringify(headerMap, null, 2)); // Depuración: Desactivado
        
        const parsedChangeEvents: ChangeEvent[] = [];
        let skippedRowsCount = 0;
        const firstSkippedRowsDetails: { rowIndex: number; missing: string; columns: string[] }[] = [];

        lines.slice(1).forEach((row, rowIndex) => {
            const columns = parseCsvRow(row, delimiter);

            const getVal = (key: string) => getColumnValue(columns, headerMap, key);
            const fechaRetiroStrRaw = getVal('fecha_retiro');
            const poleIdExternoRaw = getVal('pole_id_externo');
            const municipioRaw = getVal('municipio');
            const condicionRaw = getVal('condicion'); // Can be undefined or ''
            const componenteRaw = getVal('componente'); // Can be undefined or ''
            const streetlightIdExternoRaw = getVal('id_luminaria');
            const latRaw = getVal('lat');
            const lonRaw = getVal('lon');

            const lat = parseNumberFromCSV(latRaw);
            const lon = parseNumberFromCSV(lonRaw);

            const missingDetails: string[] = [];
            if (!fechaRetiroStrRaw) missingDetails.push(`fecha_retiro (valor: '${fechaRetiroStrRaw}')`);
            if (!poleIdExternoRaw) missingDetails.push(`pole_id_externo (valor: '${poleIdExternoRaw}')`);
            // if (!municipioRaw || municipioRaw.trim() === '') missingDetails.push(`municipio (valor: '${municipioRaw}')`); // This will now be set to Desconocido later
            // FIX: Removed condicionRaw and componenteRaw from critical missing details
            if (!streetlightIdExternoRaw) missingDetails.push(`id_luminaria (valor: '${streetlightIdExternoRaw}')`);


            if (missingDetails.length > 0) {
                skippedRowsCount++;
                if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: missingDetails.join(', '), columns: columns });
                }
                return;
            }
            const fechaRetiro = parseCustomDate(fechaRetiroStrRaw);
            if (!fechaRetiro) {
                 skippedRowsCount++;
                 if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: `fecha inválida '${fechaRetiroStrRaw}'`, columns: columns });
                 }
                 return;
            }
            
            const finalMunicipio = municipioRaw && municipioRaw.trim() !== '' ? municipioRaw : 'Desconocido';
            const municipioUpper = finalMunicipio!.toUpperCase();
            // FIX: Removed exclusion logic for specific municipalities in ChangeEvents.
            // if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') {
            //     skippedRowsCount++;
            //     if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
            //         firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: `municipio excluido '${finalMunicipio}'`, columns: columns });
            //     }
            //     return;
            // }

            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            
            const parsedChangeEvent: ChangeEvent = {
                uniqueId: `${poleIdExternoRaw!}-${fechaRetiro.getTime()}-${componenteRaw || 'NA'}`, // Ensure unique ID, use 'NA' for component
                fechaRetiro,
                condicion: condicionRaw || 'N/A', // FIX: Default to 'N/A' if empty/undefined
                poleIdExterno: poleIdExternoRaw!,
                horasFuncionamiento: parseIntegerLikeField(getVal('horas_funcionamiento')) ?? 0, // USE NEW PARSER
                recuentoConmutacion: parseIntegerLikeField(getVal('recuento_conmutacion')) ?? 0, // USE NEW PARSER
                municipio: finalMunicipio!, zone, lat: lat, lon: lon,
                streetlightIdExterno: streetlightIdExternoRaw!, 
                componente: componenteRaw || 'N/A', // FIX: Default to 'N/A' if empty/undefined
                designacionTipo: getVal('designacion_tipo') || '', 
                cabinetIdExterno: getVal('cabinetIdExterno'), // Using specific key
            };
            parsedChangeEvents.push(parsedChangeEvent);
            // if (parsedChangeEvents.length <= 5) { // Depuración: Log de las primeras 5 filas procesadas
            //     console.log("Changes: Parsed Change Event (first 5 rows):", parsedChangeEvent);
            // }
        });
        if (skippedRowsCount > 0) {
            console.warn(`Cambios: Se omitieron ${skippedRowsCount} filas en total. ${firstSkippedRowsDetails.length} detalles de las primeras filas omitidas:`);
            firstSkippedRowsDetails.forEach(detail => {
                console.warn(`  - Fila ${detail.rowIndex}: Faltante/Inválido: ${detail.missing}. Columnas crudas:`, detail.columns, 'Header Map:', JSON.stringify(headerMap, null, 2));
            });
        }
        return parsedChangeEvents;
    };

    const processInventoryCSV = (text: string): InventoryItem[] => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return [];
        const delimiter = detectDelimiter(lines[0]);
        const headerRow = parseCsvRow(lines[0], delimiter);
        const headerMap = getHeaderMap(headerRow);
        // console.log("Inventory Delimiter:", delimiter, "Header Map:", JSON.stringify(headerMap, null, 2)); // Depuración: Desactivado

        const parsedItems: InventoryItem[] = [];
        let skippedRowsCount = 0;
        const firstSkippedRowsDetails: { rowIndex: number; missing: string; columns: string[] }[] = [];

        lines.slice(1).forEach((row, rowIndex) => {
            const columns = parseCsvRow(row, delimiter);

            const getVal = (key: string) => getColumnValue(columns, headerMap, key);
            
            const streetlightIdExternoRaw = getVal('id_luminaria');
            let municipioRaw = getVal('municipio'); // Use let to allow modification
            const latRaw = getVal('lat');
            const lonRaw = getVal('lon');
            const cabinetIdExternoRaw = getVal('cabinetIdExterno'); // Raw cabinet ID
            const markedRaw = getVal('marked'); // Raw marked value

            const lat = parseNumberFromCSV(latRaw);
            const lon = parseNumberFromCSV(lonRaw);

            const missingDetails: string[] = [];
            if (!streetlightIdExternoRaw) missingDetails.push(`id_luminaria (valor: '${streetlightIdExternoRaw}')`);
            if (lat === undefined) missingDetails.push(`lat (valor: '${latRaw}')`);
            if (lon === undefined) missingDetails.push(`lon (valor: '${lonRaw}')`);
            
            // Gracefully handle empty municipio by assigning 'Desconocido'
            let finalMunicipio = municipioRaw;
            if (!municipioRaw || municipioRaw.trim() === '') {
                finalMunicipio = 'Desconocido';
            }

            // After attempting to parse and assign default for municipio, check if critical data is still missing
            if (missingDetails.length > 0) {
                 skippedRowsCount++;
                 if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: missingDetails.join(', '), columns: columns });
                 }
                 return;
            }

            const municipioUpper = finalMunicipio!.toUpperCase();
            if (municipioUpper === 'DESAFECTADOS' || municipioUpper === 'OBRA NUEVA' || municipioUpper === 'N/A') {
                skippedRowsCount++;
                if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: `municipio excluido '${finalMunicipio}'`, columns: columns });
                }
                return;
            }
            const zone = MUNICIPIO_TO_ZONE_MAP[municipioUpper] || 'Desconocida';
            
            const situacion = getVal('situacion');

            const parsedItem: InventoryItem = {
                streetlightIdExterno: streetlightIdExternoRaw!, 
                municipio: finalMunicipio!, // Use finalMunicipio
                zone, 
                lat: lat,
                lon: lon, 
                nroCuenta: getVal('nro_cuenta'),
                situacion: situacion ? situacion.toLowerCase() : undefined, 
                localidad: getVal('localidad'),
                fechaInstalacion: parseCustomDate(getVal('fecha_instalacion')),
                marked: markedRaw, // Store raw marked value
                estado: getVal('estado'),
                fechaInauguracion: parseCustomDate(getVal('fecha_inauguracion')),
                olcHardwareDir: getVal('olc_hardware_dir'), // Correctly mapped by normalizeHeader
                dimmingCalendar: getVal('dimming_calendar'),
                ultimoInforme: parseCustomDate(getVal('ultimo_informe')),
                olcIdExterno: parseNumberFromCSV(getVal('olc_id_externo')),
                luminaireIdExterno: getVal('luminaire_id_externo'),
                horasFuncionamiento: parseIntegerLikeField(getVal('horas_funcionamiento')), // USE NEW PARSER
                recuentoConmutacion: parseIntegerLikeField(getVal('recuento_conmutacion')), // USE NEW PARSER
                cabinetIdExterno: cabinetIdExternoRaw, // Use raw cabinet ID
                cabinetLat: parseNumberFromCSV(getVal('cabinet_lat')),
                cabinetLon: parseNumberFromCSV(getVal('cabinet_lon')),
                potenciaNominal: parseNumberFromCSV(getVal('potencia_nominal')),
                designacionTipo: getVal('designacion_tipo'),
            };
            parsedItems.push(parsedItem);
            // if (parsedItems.length <= 5) { // Depuración: Log de las primeras 5 filas procesadas
            //     console.log("Inventory: Parsed Item (first 5 rows):", parsedItem);
            // }
        });
        if (skippedRowsCount > 0) {
            console.warn(`Inventario: Se omitieron ${skippedRowsCount} filas en total. ${firstSkippedRowsDetails.length} detalles de las primeras filas omitidas:`);
            firstSkippedRowsDetails.forEach(detail => {
                // FIX: Ensure 'columns' is passed to the console.warn call.
                console.warn(`  - Fila ${detail.rowIndex}: Faltante/Inválido: ${detail.missing}. Columnas crudas:`, detail.columns, 'Header Map:', JSON.stringify(headerMap, null, 2));
            });
        }
        return parsedItems;
    };

    const processServicePointsCSV = (text: string): ServicePoint[] => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return [];
        const delimiter = detectDelimiter(lines[0]);
        const headerRow = parseCsvRow(lines[0], delimiter);
        const headerMap = getHeaderMap(headerRow);
        // console.log("Service Points Delimiter:", delimiter, "Header Map:", JSON.stringify(headerMap, null, 2)); // Depuración: Desactivado

        const parsedItems: ServicePoint[] = [];
        let skippedRowsCount = 0;
        const firstSkippedRowsDetails: { rowIndex: number; missing: string; columns: string[] }[] = [];

        lines.slice(1).forEach((row, rowIndex) => {
            const columns = parseCsvRow(row, delimiter);

            const getVal = (key: string) => getColumnValue(columns, headerMap, key);
            const nroCuentaRaw = getVal('nro_cuenta');
            const direccionRaw = getVal('direccion');
            const tarifaRaw = getVal('tarifa'); // Can be undefined or ''
            const potenciaContratadaRaw = getVal('potencia_contratada');
            const tensionRaw = getVal('tension'); // Can be undefined or ''
            const fasesRaw = getVal('fases');     // Can be undefined or ''
            const latRaw = getVal('lat');
            const lonRaw = getVal('lon');

            const potenciaContratada = parseNumberFromCSV(potenciaContratadaRaw);
            const lat = parseNumberFromCSV(latRaw);
            const lon = parseNumberFromCSV(lonRaw);

            const missingDetails: string[] = [];
            if (!nroCuentaRaw) missingDetails.push(`nro_cuenta (valor: '${nroCuentaRaw}')`);
            if (!direccionRaw) missingDetails.push(`direccion (valor: '${direccionRaw}')`);
            // FIX: Removed tarifaRaw from critical missing details
            if (potenciaContratada === undefined) missingDetails.push(`potencia_contratada (valor: '${potenciaContratadaRaw}')`);
            // FIX: Removed tensionRaw and fasesRaw from critical missing details
            if (lat === undefined) missingDetails.push(`lat (valor: '${latRaw}')`);
            if (lon === undefined) missingDetails.push(`lon (valor: '${lonRaw}')`);

            if (missingDetails.length > 0) {
                skippedRowsCount++;
                if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: missingDetails.join(', '), columns: columns });
                }
                return;
            }
            
            const parsedItem: ServicePoint = {
                nroCuenta: nroCuentaRaw!,
                tarifa: tarifaRaw || 'N/A',   // FIX: Default to 'N/A' if empty/undefined
                potenciaContratada: potenciaContratada!, 
                tension: tensionRaw || 'N/A', // FIX: Default to 'N/A' if empty/undefined
                fases: fasesRaw || 'N/A',     // FIX: Default to 'N/A' if empty/undefined
                cantidadLuminarias: 0, 
                direccion: direccionRaw!,
                lat: lat!,
                lon: lon!,
                alcid: getVal('alcid'), 
                porcentEf: parseNumberFromCSV(getVal('porcent_ef')),
                municipio: getVal('municipio'), // Added parsing for optional municipio
            };
            parsedItems.push(parsedItem);
            // if (parsedItems.length <= 5) { // Depuración: Log de las primeras 5 filas procesadas
            //     console.log("Service Points: Parsed Item (first 5 rows):", parsedItem);
            // }
        });
        if (skippedRowsCount > 0) {
            console.warn(`Puntos de Servicio: Se omitieron ${skippedRowsCount} filas en total. ${firstSkippedRowsDetails.length} detalles de las primeras filas omitidas:`);
            firstSkippedRowsDetails.forEach(detail => {
                // FIX: Ensure 'columns' is passed to the console.warn call.
                console.warn(`  - Fila ${detail.rowIndex}: Faltante/Inválido: ${detail.missing}. Columnas crudas:`, detail.columns, 'Header Map:', JSON.stringify(headerMap, null, 2));
            });
        }
        return parsedItems;
    };

    const processZoneBasesCSV = (text: string): ZoneBase[] => {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length <= 1) return [];
        const delimiter = detectDelimiter(lines[0]);
        const headerRow = parseCsvRow(lines[0], delimiter);
        const headerMap = getHeaderMap(headerRow);
        // console.log("Zone Bases Delimiter:", delimiter, "Header Map:", JSON.stringify(headerMap, null, 2)); // Depuración: Desactivado

        const parsedItems: ZoneBase[] = [];
        let skippedRowsCount = 0;
        const firstSkippedRowsDetails: { rowIndex: number; missing: string; columns: string[] }[] = [];

        lines.slice(1).forEach((row, rowIndex) => {
            const columns = parseCsvRow(row.trim(), delimiter);
            
            const getVal = (key: string) => getColumnValue(columns, headerMap, key);
            const zoneNameRaw = getVal('zone_name');
            const latRaw = getVal('lat');
            const lonRaw = getVal('lon');

            const lat = parseNumberFromCSV(latRaw);
            const lon = parseNumberFromCSV(lonRaw);

            const missingDetails: string[] = [];
            // FIX: Added trim() === '' check for zoneNameRaw
            if (!zoneNameRaw || zoneNameRaw.trim() === '') missingDetails.push(`zone_name (valor: '${zoneNameRaw}')`);
            if (lat === undefined) missingDetails.push(`lat (valor: '${latRaw}')`);
            if (lon === undefined) missingDetails.push(`lon (valor: '${lonRaw}')`);

            if (missingDetails.length > 0) {
                skippedRowsCount++;
                if (firstSkippedRowsDetails.length < SKIPPED_ROW_WARNING_THRESHOLD) {
                    firstSkippedRowsDetails.push({ rowIndex: rowIndex + 1, missing: missingDetails.join(', '), columns: columns });
                }
                return;
            }
            
            const parsedItem: ZoneBase = { 
                zoneName: zoneNameRaw!.toUpperCase(), // Ensure uppercase for map matching
                lat: lat!, 
                lon: lon! 
            };
            parsedItems.push(parsedItem);
            // if (parsedItems.length <= 5) { // Depuración: Log de las primeras 5 filas procesadas
            //     console.log("Zone Bases: Parsed Item (first 5 rows):", parsedItem);
            // }
        });
        if (skippedRowsCount > 0) {
            console.warn(`Bases de Zona: Se omitieron ${skippedRowsCount} filas en total. ${firstSkippedRowsDetails.length} detalles de las primeras filas omitidas:`);
            firstSkippedRowsDetails.forEach(detail => {
                // FIX: Ensure 'columns' is passed to the console.warn call.
                console.warn(`  - Fila ${detail.rowIndex}: Faltante/Inválido: ${detail.missing}. Columnas crudas:`, detail.columns, 'Header Map:', JSON.stringify(headerMap, null, 2));
            });
        }
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
            const totalInventory = inventoryCountByZone[zone];
            
            const eventosReales = Math.max(0, zoneCounts.eventos - zoneCounts.eventosGabinete - zoneCounts.eventosVandalismo);
            
            const failedLuminaireIds = Array.from(new Set(dailyFailureEvents.filter(e => e.zone === zone).map(e => e.id)));

            const snapshotForZone: HistoricalZoneData = {
                name: zone,
                eventos: zoneCounts.eventos,
                eventosGabinete: zoneCounts.eventosGabinete,
                eventosVandalismo: zoneCounts.eventosVandalismo,
                eventosReales,
                totalInventario: totalInventory,
                porcentaje: totalInventory > 0 ? (zoneCounts.eventos / totalInventory) * 100 : 0,
                porcentajeGabinete: totalInventory > 0 ? (zoneCounts.eventosGabinete / totalInventory) * 100 : 0,
                porcentajeVandalismo: totalInventory > 0 ? (zoneCounts.eventosVandalismo / totalInventory) * 100 : 0,
                porcentajeReal: totalInventory > 0 ? (eventosReales / totalInventory) * 100 : 0,
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
            // console.log("Attempting to fetch data source URLs from Firebase..."); // Depuración: Desactivado
            const firebaseResponse = await fetch(FIREBASE_BASE_URL + FIREBASE_URLS_PATH);
            if (!firebaseResponse.ok) {
                throw new Error(`Error ${firebaseResponse.status}: ${firebaseResponse.statusText}.`);
            }
            const data = await firebaseResponse.json();
            if (!data || !data.events || !data.changes || !data.inventory || !data.servicePoints || !data.zoneBases) {
                throw new Error("La estructura de URLs en Firebase es inválida o incompleta. Asegúrese de que existen 'events', 'changes', 'inventory', 'servicePoints' y 'zoneBases'.");
            }
            urls = data as DataSourceURLs;
            // console.log("URLs de fuentes de datos cargadas desde Firebase:", urls); // Depuración: Desactivado
        } catch (e: any) {
            const firebaseErrorMsg = `No se pudo obtener la configuración de fuentes de datos de Firebase: ${e.message}. Asegúrese de que la ruta '/dataSourceURLs.json' existe y es accesible en su Realtime Database.`;
            console.error("Failed to fetch URLs from Firebase", e);
            try {
                // console.log("Intentando cargar datos desde la caché de IndexedDB..."); // Depuración: Desactivado
                const [cachedEvents, cachedChanges, cachedInventory, cachedServicePoints, cachedZoneBases, cachedHistory] = await Promise.all([
                    db.getAll(LUMINAIRE_EVENTS_STORE),
                    db.getAll(CHANGE_EVENTS_STORE),
                    db.getAll(INVENTORY_STORE),
                    db.getAll(SERVICE_POINTS_STORE),
                    db.getAll(ZONE_BASES_STORE),
                    fetch(FIREBASE_BASE_URL + FIREBASE_HISTORY_PATH + '.json')
                        .then(res => { if (!res.ok) throw new Error(res.statusText); return res.json() as Promise<HistoricalData>; })
                        .catch(e => { console.warn("Falló la carga de datos históricos desde Firebase:", e); return {} as HistoricalData; })
                ]);
                setAllEvents(cachedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
                setChangeEvents(cachedChanges.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
                setInventory(cachedInventory);
                setServicePoints(cachedServicePoints);
                setZoneBases(cachedZoneBases);
                setHistoricalData(cachedHistory || {});
                 if (cachedEvents.length === 0 && cachedChanges.length === 0 && cachedInventory.length === 0) {
                    setError(`${firebaseErrorMsg} No hay datos en la caché local.`);
                } else {
                    setError(`Se cargaron datos de la caché local debido al fallo en Firebase. ${firebaseErrorMsg}`);
                    // console.log("Datos cargados desde la caché de IndexedDB."); // Depuración: Desactivado
                }
            } catch (dbError) {
                console.error("Error loading from IndexedDB cache after Firebase URL failure:", dbError);
                setError(`${firebaseErrorMsg} Y también falló la carga desde la caché local: ${dbError}.`);
            } finally {
                setLoading(false);
            }
            return;
        }

        try {
            // console.log("Attempting to fetch CSV files from Google Sheets..."); // Depuración: Desactivado
            
            // FIX: Explicitly defined `store` type to resolve type inference issues.
            interface DataConfig {
                name: string;
                url: string;
                processor: (text: string) => any[];
                setter: Dispatch<SetStateAction<any[]>>; 
                store: 'luminaireEvents' | 'changeEvents' | 'inventory' | 'servicePoints' | 'zoneBases'; 
            }

            const fetchPromises: DataConfig[] = [
                { name: 'Eventos', url: urls.events, processor: processEventsCSV, setter: setAllEvents, store: LUMINAIRE_EVENTS_STORE },
                { name: 'Cambios', url: urls.changes, processor: processChangeEventsCSV, setter: setChangeEvents, store: CHANGE_EVENTS_STORE },
                { name: 'Inventario', url: urls.inventory, processor: processInventoryCSV, setter: setInventory, store: INVENTORY_STORE },
                { name: 'Puntos de Servicio', url: urls.servicePoints, processor: processServicePointsCSV, setter: setServicePoints, store: SERVICE_POINTS_STORE },
                { name: 'Bases de Zona', url: urls.zoneBases, processor: processZoneBasesCSV, setter: setZoneBases, store: ZONE_BASES_STORE },
            ];

            const results = await Promise.allSettled(
                fetchPromises.map(async (dataConfig) => {
                    const response = await fetch(dataConfig.url);
                    if (!response.ok) {
                        throw new Error(`Error HTTP ${response.status} para ${dataConfig.name}: ${response.statusText}`);
                    }
                    const text = await response.text();
                    const parsedData = dataConfig.processor(text);
                    if (parsedData.length === 0) {
                        console.warn(`Advertencia: La planilla de ${dataConfig.name} se cargó correctamente, pero no se encontraron datos válidos después de procesar el CSV. Verifique el formato o los encabezados.`);
                    }
                    return { name: dataConfig.name, data: parsedData, setter: dataConfig.setter, store: dataConfig.store };
                })
            );

            const accumulatedErrors: string[] = [];
            // FIX: Explicitly defined `store` type to resolve type inference issues.
            const successfulData: { name: string; data: any[]; setter: Dispatch<SetStateAction<any[]>>; store: 'luminaireEvents' | 'changeEvents' | 'inventory' | 'servicePoints' | 'zoneBases'; }[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    successfulData.push(result.value);
                } else {
                    accumulatedErrors.push(result.reason.message || `Error desconocido al cargar una fuente de datos.`);
                }
            }

            if (accumulatedErrors.length > 0) {
                setError(`Errores al cargar algunas fuentes de datos: ${accumulatedErrors.join('; ')}`);
            }
             
            // Fetch historical data separately, allowing app to proceed even if it fails
            let history: HistoricalData = {};
            try {
                // console.log("Attempting to fetch historical snapshot data..."); // Depuración: Desactivado
                const historicalDataResponse = await fetch(FIREBASE_BASE_URL + FIREBASE_HISTORY_PATH + '.json');
                if (!historicalDataResponse.ok) {
                    console.warn(`Could not fetch historical data: ${historicalDataResponse.statusText} (${historicalDataResponse.status}). Proceeding without it.`);
                } else {
                    history = await historicalDataResponse.json() as HistoricalData;
                    // console.log("Historical data loaded."); // Depuración: Desactivado
                }
            } catch (histError) {
                console.warn("Failed to fetch historical data, proceeding without it:", histError);
            }
            setHistoricalData(history || {});

            // console.log("Storing data in IndexedDB..."); // Depuración: Desactivado
            const tx = db.transaction([LUMINAIRE_EVENTS_STORE, CHANGE_EVENTS_STORE, INVENTORY_STORE, SERVICE_POINTS_STORE, ZONE_BASES_STORE], 'readwrite');
            const storePromises: Promise<any>[] = [];

            successfulData.forEach(({ name, data, setter, store }) => {
                // FIX: Explicitly cast `store` to a union type to satisfy TypeScript's strict type checking for objectStore.
                storePromises.push(tx.objectStore(store as 'luminaireEvents' | 'changeEvents' | 'inventory' | 'servicePoints' | 'zoneBases').clear());
                if (data.length > 0) {
                    // FIX: Explicitly cast `store` to a union type to satisfy TypeScript's strict type checking for objectStore.
                    storePromises.push(...data.map(item => tx.objectStore(store as 'luminaireEvents' | 'changeEvents' | 'inventory' | 'servicePoints' | 'zoneBases').put(item)));
                }
                // Update React state directly
                if (store === LUMINAIRE_EVENTS_STORE) setAllEvents(data.sort((a,b) => b.date.getTime() - a.date.getTime()));
                else if (store === CHANGE_EVENTS_STORE) setChangeEvents(data.sort((a,b) => b.fechaRetiro.getTime() - a.fechaRetiro.getTime()));
                else if (store === INVENTORY_STORE) setInventory(data);
                else if (store === SERVICE_POINTS_STORE) setServicePoints(data);
                else if (store === ZONE_BASES_STORE) setZoneBases(data);
            });
            
            await Promise.all(storePromises); // Wait for all IndexedDB operations
            await tx.done;
            // console.log("Data stored in IndexedDB."); // Depuración: Desactivado

            // Apply augmentation for events AFTER all inventory is loaded
            const fullInventory = successfulData.find(d => d.store === INVENTORY_STORE)?.data || [];
            const allEventsRaw = successfulData.find(d => d.store === LUMINAIRE_EVENTS_STORE)?.data || [];

            // FIX: Changed inventoryDataMap to store full InventoryItem objects.
            const inventoryDataMap = new Map<string, InventoryItem>();
            fullInventory.forEach((item: InventoryItem) => {
                if (item.streetlightIdExterno) {
                    inventoryDataMap.set(item.streetlightIdExterno, item);
                }
            });

            const augmentedEvents = allEventsRaw.map((event: LuminaireEvent) => {
                const inventoryData = inventoryDataMap.get(event.id);
                return {
                    ...event,
                    olcHardwareDir: inventoryData?.olcHardwareDir,
                    power: inventoryData?.potenciaNominal?.toString(), 
                };
            });
            setAllEvents(augmentedEvents.sort((a,b) => b.date.getTime() - a.date.getTime()));
            
            // --- Save Daily Snapshot to Firebase ---
            // console.log("Calculating and saving daily historical snapshot..."); // Depuración: Desactivado
            // Use augmented events for snapshot calculation
            const fullAugmentedEventsForSnapshot = allEventsRaw.map((event: LuminaireEvent) => {
                const inventoryData = inventoryDataMap.get(event.id);
                // Ensure event.zone and event.municipio are populated correctly even if missing from event directly
                const fullEvent = {
                    ...event,
                    // FIX: Accessing zone and municipio from `inventoryData` (which is now InventoryItem).
                    zone: event.zone || inventoryData?.zone || (event.municipio ? (MUNICIPIO_TO_ZONE_MAP[event.municipio.toUpperCase()] || 'Desconocida') : 'Desconocida'),
                    municipio: event.municipio || inventoryData?.municipio || 'Desconocido',
                    nroCuenta: event.nroCuenta || inventoryData?.nroCuenta, // Also augment nroCuenta for historical snapshot
                };
                return {
                    ...fullEvent,
                    olcHardwareDir: inventoryData?.olcHardwareDir,
                    power: inventoryData?.potenciaNominal?.toString(), 
                };
            });
            // Also ensure fullInventory items have zone/municipio from MUNICIPIO_TO_ZONE_MAP if they only have municipio
            const augmentedInventoryForSnapshot = fullInventory.map((item: InventoryItem) => {
                const municipioUpper = item.municipio?.toUpperCase();
                return {
                    ...item,
                    zone: item.zone || (municipioUpper && MUNICIPIO_TO_ZONE_MAP[municipioUpper]) || 'Desconocida'
                };
            });

            const dailySnapshot = calculateDailySnapshot(fullAugmentedEventsForSnapshot, augmentedInventoryForSnapshot);
            if(Object.keys(dailySnapshot).length > 0) {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                await fetch(`${FIREBASE_BASE_URL}${FIREBASE_HISTORY_PATH}/${todayStr}.json`, {
                    method: 'PUT',
                    body: JSON.stringify(dailySnapshot),
                    headers: { 'Content-Type': 'application/json' }
                });
                // console.log(`Daily snapshot for ${todayStr} saved to Firebase.`); // Depuración: Desactivado
                // Optimistically update local state for immediate feedback
                setHistoricalData(prev => ({...prev, [todayStr]: dailySnapshot}));
            } else {
                // console.log("No data for daily snapshot, skipping save to Firebase."); // Depuración: Desactivado
            }


        } catch (e: any) {
            console.error("Failed to fetch or process data", e);
            setError(`Error al obtener datos: ${e.message}. Verifique las URLs en Firebase, los permisos de Google Sheets y la estructura de los archivos CSV.`);
        } finally {
            setLoading(false);
            // console.log("Data fetching and processing complete."); // Depuración: Desactivado
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
