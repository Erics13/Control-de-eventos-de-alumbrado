
import React from 'react';
import type { ServicePoint } from '../types';

interface Props {
    servicePoints: ServicePoint[];
}

const FailedCabinetAccountsTable: React.FC<Props> = ({ servicePoints }) => {
    
    if (servicePoints.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 rounded-lg bg-gray-900/50 p-4">
                No se encontraron detalles para los servicios con falla. Verifique que los números de cuenta coincidan en las planillas.
            </div>
        );
    }
    
    const handleMapClick = (lat: number, lon: number, nroCuenta: string) => {
        const url = `https://www.google.com/maps?q=${lat},${lon}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="overflow-auto border border-gray-700 rounded-lg" style={{maxHeight: '400px'}}>
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nro. Cuenta</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Dirección</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tarifa</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pot. Cont. (kW)</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tensión</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fases</th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Mapa</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {servicePoints.map((sp) => {
                        const hasLocation = sp.lat != null && sp.lon != null && !isNaN(sp.lat) && !isNaN(sp.lon);
                        return (
                            <tr key={sp.nroCuenta} className="hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.nroCuenta}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.direccion}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.tarifa}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.potenciaContratada?.toLocaleString('es-ES') ?? 'N/A'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.tension}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.fases}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                    {hasLocation ? (
                                        <button
                                            onClick={() => handleMapClick(sp.lat, sp.lon, sp.nroCuenta)}
                                            className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded-full transition-colors"
                                            title={`Ver ubicación de la cuenta ${sp.nroCuenta} en Google Maps`}
                                            aria-label={`Ver ubicación de la cuenta ${sp.nroCuenta} en Google Maps`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    ) : (
                                        <span className="text-gray-500 text-xs">N/A</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default FailedCabinetAccountsTable;