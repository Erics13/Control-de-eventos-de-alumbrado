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

const PALETTE = [
    '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
    '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef',
    '#ec4899', '#78716c'
];

const categoryColorMap = new Map<string, string>();
let colorIndex = 0;

export const getCategoryColor = (category: string): string => {
    if (!categoryColorMap.has(category)) {
        categoryColorMap.set(category, PALETTE[colorIndex % PALETTE.length]);
        colorIndex++;
    }
    return categoryColorMap.get(category)!;
};