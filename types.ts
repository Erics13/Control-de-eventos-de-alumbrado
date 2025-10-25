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

export type ActiveTab = 'eventos' | 'cambios' | 'inventario';

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
