import L from 'leaflet';

export interface LuminaireEvent {
  uniqueEventId: string;
  id: string;
  olcId?: string;
  power?: string;
  date: Date;
  municipio: string;
  zone: string;
  status: 'OPERATIONAL' | 'FAILURE';
  failureCategory?: string;
  description: string;
  lat?: number;
  lon?: number;
  olcHardwareDir?: string;
  systemMeasuredPower?: number;
}

export interface ChangeEvent {
  uniqueId: string;
  fechaRetiro: Date;
  condicion: string;
  poleIdExterno: string;
  horasFuncionamiento: number;
  recuentoConmutacion: number;
  municipio: string;
  zone: string;
  lat?: number;
  lon?: number;
  streetlightIdExterno: string;
  componente: string;
  designacionTipo: string;
  cabinetIdExterno: string;
}

export interface InventoryItem {
  streetlightIdExterno: string;
  municipio: string;
  zone: string;
  lat?: number;
  lon?: number;
  nroCuenta?: string;
  situacion?: string;
  localidad?: string;
  fechaInstalacion?: Date;
  marked?: string;
  estado?: string;
  fechaInauguracion?: Date;
  olcHardwareDir?: string;
  dimmingCalendar?: string;
  ultimoInforme?: Date;
  olcIdExterno?: number;
  luminaireIdExterno?: string;
  horasFuncionamiento?: number;
  recuentoConmutacion?: number;
  cabinetIdExterno?: string;
  cabinetLat?: number;
  cabinetLon?: number;
  potenciaNominal?: number;
  designacionTipo?: string;
}

export interface ServicePoint {
  nroCuenta: string;
  tarifa: string;
  potenciaContratada: number;
  tension: string;
  fases: string;
  cantidadLuminarias: number;
  direccion: string;
  lat: number;
  lon: number;
}

export interface ZoneBase {
  zoneName: string;
  lat: number;
  lon: number;
}

export type ActiveTab = 'eventos' | 'cambios' | 'inventario' | 'historial' | 'mantenimiento';

export type BroadcastMessageType = 'STATE_UPDATE' | 'DOCK_TAB' | 'REQUEST_INITIAL_STATE' | 'INITIAL_STATE_RESPONSE';

export interface BroadcastMessage {
    type: BroadcastMessageType;
    payload: any;
}

export interface DataSourceURLs {
    events: string;
    changes: string;
    inventory: string;
    servicePoints: string;
    zoneBases: string;
}

// Represents the detailed failure data for a single zone on a specific day
export interface HistoricalZoneData {
  name: string;
  // Counts
  eventos: number; // Total failure events
  eventosGabinete: number;
  eventosVandalismo: number;
  eventosReales: number;
  totalInventario: number;
  // Percentages
  porcentaje: number; // Total percentage
  porcentajeGabinete: number;
  porcentajeVandalismo: number;
  porcentajeReal: number;
  // List of unique IDs for this day
  failedLuminaireIds?: string[];
  cabinetFailureLuminaireIds?: string[];
  // Raw category counts
  [category: string]: any;
}

// Represents the entire historical data structure fetched from Firebase
export interface HistoricalData {
  [date: string]: { // e.g., "2024-07-29"
    [zone: string]: HistoricalZoneData; // e.g., "ZONA A"
  };
}


export interface WorksheetRow {
  index: number;
  idLuminariaOlc: string;
  idGabinete?: string;
  potencia?: string;
  fechaReporte: string;
  categoria?: string;
  situacion?: string;
  mensajeDeError: string;
  accion: string;
  posibleSolucion: string;
  event: LuminaireEvent;
}


interface BaseWorksheet {
  id: string;
  title: string;
  municipio?: string;
}

export interface LuminariaWorksheet extends BaseWorksheet {
  type: 'luminaria';
  failures: WorksheetRow[];
  totalFailuresInZone: number;
}

export interface CabinetWorksheet extends BaseWorksheet {
  type: 'cabinet_falla_total' | 'cabinet_falla_parcial';
  servicePoint: ServicePoint;
  luminaires: InventoryItem[];
  inaccessiblePercentage?: number;
  inaccessibleCount?: number;
}

export type WorksheetData = LuminariaWorksheet | CabinetWorksheet;