
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
  olcIdExterno?: string;
  luminaireIdExterno?: string;
  horasFuncionamiento?: number;
  recuentoConmutacion?: number;
  cabinetIdExterno?: string;
  cabinetLat?: number;
  cabinetLon?: number;
  potenciaNominal?: number;
  designacionTipo?: string;
}
