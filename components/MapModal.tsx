
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { ServicePoint } from '../types';

// Fix for default marker icon issue with webpack
// FIX: Removed L.Icon.Default.mergeOptions as it can reintroduce default marker image paths.
// We rely on explicit icon options or L.divIcon for custom markers.
// FIX: Removed delete (L.Icon.Default.prototype as any)._getIconUrl; as it is now handled in index.html


interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    servicePoints: ServicePoint[];
}

const MapModal: React.FC<MapModalProps> = ({ isOpen, onClose, title, servicePoints }) => {
    // FIX: Corrected typo from 'HTMLDivLlement' to 'HTMLDivElement'
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        
        // Wait for render
        const timer = setTimeout(() => {
             if (mapContainerRef.current && !mapRef.current) {
                const map = L.map(mapContainerRef.current).setView([-34.7, -56.0], 10);
                mapRef.current = map;
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);
            }
            
            if (mapRef.current) {
                const map = mapRef.current;
                
                // Clear markers
                markersRef.current.forEach(m => m.remove());
                markersRef.current = [];

                if (servicePoints.length > 0) {
                    const bounds = L.latLngBounds([]);
                    servicePoints.forEach(sp => {
                        // FIX: Use a completely transparent, zero-size icon for all markers in MapModal
                        // to ensure no default pin image appears.
                        const invisibleIcon = L.icon({
                            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                            iconSize: [0, 0],
                            iconAnchor: [0, 0],
                            popupAnchor: [0, 0],
                            tooltipAnchor: [0, 0]
                        });
                        
                        const marker = L.marker([sp.lat, sp.lon], { icon: invisibleIcon }).addTo(map);
                        marker.bindPopup(`
                            <div class="text-sm">
                                <p class="font-bold">${sp.direccion}</p>
                                <p><strong>Nro. Cuenta:</strong> ${sp.nroCuenta}</p>
                                <p><strong>Tarifa:</strong> ${sp.tarifa}</p>
                                <p><strong>Potencia:</strong> ${sp.potenciaContratada} kW</p>
                            </div>
                        `);
                        bounds.extend([sp.lat, sp.lon]);
                        markersRef.current.push(marker);
                    });
                    map.fitBounds(bounds, { padding: [50, 50] });
                }
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isOpen, servicePoints]);

    // Clean up map on unmount
    useEffect(() => {
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

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
                <div className="flex-grow rounded-b-xl overflow-hidden relative">
                    {servicePoints.length > 0 ? (
                        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
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