import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ServicePoint } from '../types';

// Fix for default marker icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    servicePoints: ServicePoint[];
}

const MapBoundsUpdater: React.FC<{ points: ServicePoint[] }> = ({ points }) => {
    const map = useMap();
    useEffect(() => {
        if (points && points.length > 0) {
            const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [points, map]);
    return null;
};

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, title, servicePoints }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-modal-title"
        >
            <div 
                className="bg-gray-800 rounded-xl shadow-2xl w-11/12 h-5/6 md:w-4/5 md:h-5/6 flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h2 id="map-modal-title" className="text-xl font-bold text-cyan-400">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Cerrar modal">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-grow rounded-b-xl overflow-hidden">
                    {servicePoints.length > 0 ? (
                        <MapContainer center={[-34.7, -56.0]} zoom={10} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {servicePoints.map(sp => (
                                <Marker key={sp.nroCuenta} position={[sp.lat, sp.lon]}>
                                    <Popup>
                                        <div className="text-sm">
                                            <p className="font-bold">{sp.direccion}</p>
                                            <p><strong>Nro. Cuenta:</strong> {sp.nroCuenta}</p>
                                            <p><strong>Tarifa:</strong> {sp.tarifa}</p>
                                            <p><strong>Potencia:</strong> {sp.potenciaContratada} kW</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                            <MapBoundsUpdater points={servicePoints} />
                        </MapContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            No hay puntos de servicio con coordenadas para mostrar en el mapa.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MapModal;