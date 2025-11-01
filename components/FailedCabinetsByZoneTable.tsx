import React from 'react';

interface CabinetFailureSummary {
    name: string; // Zone name
    count: number;
    accounts: string[];
}

interface Props {
    data: CabinetFailureSummary[];
    onRowClick: (zoneName: string) => void;
    selectedZone: string | null;
    onShowMap: (zoneName: string) => void;
}

const FailedCabinetsByZoneTable: React.FC<Props> = ({ data, onRowClick, selectedZone, onShowMap }) => {
    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500 rounded-lg bg-gray-900/50">No hay tableros con falla para mostrar con los filtros actuales.</div>;
    }

    const handleMapClick = (e: React.MouseEvent, zoneName: string) => {
        e.stopPropagation(); // Prevent row click from firing
        onShowMap(zoneName);
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Zona</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tableros con Falla</th>
                        <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Mapa</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map((item) => (
                        <tr 
                            key={item.name} 
                            onClick={() => onRowClick(item.name)}
                            className={`cursor-pointer transition-colors duration-150 ${
                                selectedZone === item.name 
                                    ? 'bg-cyan-900/50' 
                                    : 'hover:bg-gray-700/50'
                            }`}
                        >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-400">{item.count.toLocaleString()}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                <button
                                    onClick={(e) => handleMapClick(e, item.name)}
                                    className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded-full transition-colors"
                                    title={`Ver ubicación de tableros con falla en ${item.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="sr-only">Ver en mapa</span>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">Un tablero se considera con falla si más del 90% de sus luminarias asociadas están inaccesibles.</p>
        </div>
    );
};

export default FailedCabinetsByZoneTable;