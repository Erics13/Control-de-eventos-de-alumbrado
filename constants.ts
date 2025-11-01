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
export const ZONE_ORDER = ['ZONA A', 'ZONA B', 'ZONA B1', 'ZONA B2', 'ZONA B3', 'ZONA C', 'ZONA D'];


export const FAILURE_CATEGORY_TRANSLATIONS: Record<string, string> = {
    'Unreachable': 'Inaccesible',
    'Broken': 'Roto',
    'Unspecific warning': 'Falla de voltaje',
    'Configuration error': 'Error de configuración',
    'Hardware failure': 'Falla de hardware',
    'Information': 'Información',
};

export const ACTION_SOLUTION_MAP = [
  // Categoria: Inaccesible (Unreachable)
  {
    category: 'Inaccesible',
    messageSubstring: 'el punto de luz no tiene energía',
    action: 'Revisar código de OLC, revisar energía, que no sea un problema eléctrico, llave térmica, conectores, probar luminaria con puente, etc. Aplicar reseteo de OLC.',
    solution: 'Corregir código de OLC en Interact. Reparar posible problema eléctrico.'
  },
  {
    category: 'Inaccesible',
    messageSubstring: 'el olc no está accesible',
    action: 'Revisar código de OLC, revisar energía, que no sea un problema eléctrico, llave térmica, conectores, probar luminaria con puente, etc. Aplicar reseteo de OLC.',
    solution: 'Corregir código de OLC en Interact. Reparar posible problema eléctrico.'
  },
  // Categoria: Roto (Broken)
  {
    category: 'Roto',
    messageSubstring: 'la corriente medida es menor que lo esperado',
    action: 'Medir consumo de luminaria en sitio, comparar con el consumo medido en Interact (RTP).',
    solution: 'Posible cambio de Luminaria.'
  },
  {
    category: 'Roto',
    messageSubstring: 'la corriente medida para la combinación de driver y lámpara es mayor que la esperada',
    action: 'Medir consumo de luminaria en sitio, comparar con el consumo medido en Interact (RTP).',
    solution: 'Posible cambio de Luminaria.'
  },
  {
    category: 'Roto',
    messageSubstring: 'corte de luz parcial',
    action: 'Medir consumo de luminaria, posible placa de led rota o algunos led quemados. Revisar posible vandalismo.',
    solution: 'Posible cambio de Luminaria.'
  },
  {
    category: 'Roto',
    messageSubstring: 'Posible falla en el driver',
    action: 'Medir consumo de luminaria en sitio, comparar con el consumo medido en Interact (RTP).',
    solution: 'Posible cambio de Luminaria.'
  },
  {
    category: 'Roto',
    messageSubstring: 'el componente de medición de energía está roto',
    action: 'Cambio de OLC.',
    solution: 'Cambio de OLC.'
  },
  {
    category: 'Roto',
    messageSubstring: 'el chip del gps en el nodo está roto',
    action: 'Cambio de OLC.',
    solution: 'Cambio de OLC.'
  },
  {
    category: 'Roto',
    messageSubstring: 'la luminaria no se regula',
    action: 'Medir consumo de luminaria en sitio, comparar con el consumo medido en Interact (RTP).',
    solution: 'Revisar configuración de tipo de luminaria en Interact. Reconectar a Gabinete.'
  },
  // Categoria: Error de configuración (Configuration error)
  {
    category: 'Error de configuración',
    messageSubstring: 'se puso en servicio incorrectamente el olc',
    action: 'La OLC instalada no se puede comunicar con el gabinete porque ya esta vinculada con otro gabinete. Cambio de OLC.',
    solution: 'Cambio de OLC.'
  },
  // Categoria: Falla de hardware (Hardware failure)
  {
    category: 'Falla de hardware',
    messageSubstring: 'posible falla del relé en el olc',
    action: 'Comprobar encendido y apagado para ver correcto funcionamiento del relé de la OLC.',
    solution: 'Cambio de OLC.'
  },
  // Categoria: Falla de voltaje (Unspecific warning)
  {
    category: 'Falla de voltaje',
    messageSubstring: 'el voltaje de la red eléctrica de entrada detectado del sistema es muy bajo o muy alto',
    action: 'Medir voltaje en llave térmica individual de la luminaria, comparar con el consumo medido en Interact (RTP). Posible falla en térmica o conectores.',
    solution: 'Cambio de llave térmica o conectores.'
  },
];


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
