export const MUNICIPIO_TO_ZONE_MAP: Record<string, string> = {
    'AGUAS CORRIENTES': 'ZONA A',
    'SANTA LUCÍA': 'ZONA A',
    'SANTA LUCIA': 'ZONA A',
    'CERRILLOS': 'ZONA A',
    'JUANICO': 'ZONA A',
    'CANELONES': 'ZONA A',
    'LA PAZ': 'ZONA B',
    'LAS PIEDRAS': 'ZONA B',
    '18 DE MAYO': 'ZONA B',
    'PROGRESO': 'ZONA B',
    'NICOLICH': 'ZONA B1',
    'PASO CARRASCO': 'ZONA B1',
    'CIUDAD DE LA COSTA': 'ZONA B1',
    'ATLANTIDA': 'ZONA B2',
    'PARQUE DEL PLATA': 'ZONA B2',
    'SALINAS': 'ZONA B2',
    'SOCA': 'ZONA B3',
    'LA FLORESTA': 'ZONA B3',
    'PANDO': 'ZONA C',
    'BARROS BLANCOS': 'ZONA C',
    'SAUCE': 'ZONA C',
    'EMPALME OLMOS': 'ZONA C',
    'TOLEDO': 'ZONA C',
    'DEL ANDALUZ': 'ZONA C',
    'SUAREZ': 'ZONA C',
    'TALA': 'ZONA D',
    'SAN RAMON': 'ZONA D',
    'MONTES': 'ZONA D',
    'MIGUES': 'ZONA D',
    'SAN ANTONIO': 'ZONA D',
    'SANTA ROSA': 'ZONA D',
    'SAN JACINTO': 'ZONA D',
    'SAN BAUTISTA': 'ZONA D',
};

export const ALL_ZONES: string[] = Array.from(new Set(Object.values(MUNICIPIO_TO_ZONE_MAP))).sort();

export const FAILURE_CATEGORY_TRANSLATIONS: Record<string, string> = {
    'Unreachable': 'Inaccesible',
    'Broken': 'Roto',
    'Unspecific warning': 'Falla de voltaje',
    'Configuration error': 'Error de configuración',
    'Hardware failure': 'Falla de hardware',
    'Information': 'Información',
};

const FAILURE_CATEGORY_PALETTE = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
    '#ec4899', '#78716c'
];

const failureCategoryColorMap = new Map<string, string>();
let failureCategoryColorIndex = 0;

export const getCategoryColor = (category: string): string => {
    if (!failureCategoryColorMap.has(category)) {
        failureCategoryColorMap.set(category, FAILURE_CATEGORY_PALETTE[failureCategoryColorIndex % FAILURE_CATEGORY_PALETTE.length]);
        failureCategoryColorIndex++;
    }
    return failureCategoryColorMap.get(category)!;
};

const ZONE_PALETTE = [
    '#3b82f6', // ZONA A - blue
    '#ef4444', // ZONA B - red
    '#f97316', // ZONA B1 - orange
    '#eab308', // ZONA B2 - yellow
    '#84cc16', // ZONA B3 - lime
    '#14b8a6', // ZONA C - teal
    '#8b5cf6', // ZONA D - violet
    '#ec4899', // pink for any others
    '#78716c'  // gray for any others
];
const zoneColorMap = new Map<string, string>();
let zoneColorIndex = 0;

export const getZoneColor = (zone: string): string => {
    if (!zoneColorMap.has(zone)) {
        zoneColorMap.set(zone, ZONE_PALETTE[zoneColorIndex % ZONE_PALETTE.length]);
        zoneColorIndex++;
    }
    return zoneColorMap.get(zone)!;
};