import React from 'react';
import type { LuminaireEvent } from '../types';

interface OldestEventsByZoneProps {
    data: LuminaireEvent[];
}

const OldestEventsByZone: React.FC<OldestEventsByZoneProps> = ({ data }) => {
    if (data.length === 0) {
        return null;
    }
    
    const handleRowClick = (event: LuminaireEvent) => {
        if (event.lat && event.lon) {
            const url = `https://www.google.com/maps?q=${event.lat},${event.lon}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="bg-gray-800 shadow-lg rounded-xl p-6 mb-8">
            <h3 className="text-xl font-semibold text-cyan-400 mb-4">Eventos Reportados Más Antiguos por Zona</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Zona</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Punto de Alumbrado</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">OLC/Dirección de hardware</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Potencia</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Categoría de Falla</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mensaje</th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {data.map((event) => {
                             const isClickable = event.lat != null && event.lon != null;
                             return (
                                <tr 
                                    key={event.uniqueEventId} 
                                    onClick={() => handleRowClick(event)}
                                    className={`${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''} transition-colors duration-150`}
                                    title={isClickable ? `Ver ubicación de ${event.id} en el mapa` : ''}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">{event.zone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.date.toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.id}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.olcId || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.power || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.failureCategory || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-400 max-w-sm">{event.description}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OldestEventsByZone;