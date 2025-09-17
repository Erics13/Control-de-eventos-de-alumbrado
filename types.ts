
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