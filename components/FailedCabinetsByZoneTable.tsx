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
}

const FailedCabinetsByZoneTable: React.FC<Props> = ({ data, onRowClick, selectedZone }) => {
    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500 rounded-lg bg-gray-900/50">No hay tableros con falla para mostrar con los filtros actuales.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Zona</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tableros con Falla</th>
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
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">Un tablero se considera con falla si más del 90% de sus luminarias asociadas están inaccesibles.</p>
        </div>
    );
};

export default FailedCabinetsByZoneTable;
