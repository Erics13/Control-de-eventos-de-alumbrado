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

export type ActiveTab = 'eventos' | 'cambios' | 'inventario' | 'historial';

export type BroadcastMessageType = 'STATE_UPDATE' | 'DOCK_TAB' | 'REQUEST_INITIAL_STATE' | 'INITIAL_STATE_RESPONSE';

export interface BroadcastMessage {
    type: BroadcastMessageType;
    payload: any;
}

export interface DataSourceURLs {
    events: string;
    changes: string;
    inventory: string;
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