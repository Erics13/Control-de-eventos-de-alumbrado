import React, { useMemo } from 'react';
import { ZONE_ORDER } from '../constants';

interface MonthlyCountsSummary {
    monthKey: string;
    monthName: string;
    date: Date;
    zoneCounts: Record<string, number>;
}

interface MonthlyEventCountsTableProps {
    data: {
        tableData: MonthlyCountsSummary[];
        zones: string[];
    };
}

const MonthlyEventCountsTable: React.FC<MonthlyEventCountsTableProps> = ({ data }) => {
    
    const { tableData, zones } = data;

    if (!tableData || tableData.length === 0) {
      return (
        <div className="flex items-center justify-center h-40 text-gray-500">
            <p className="text-center">No hay datos de eventos para mostrar el recuento mensual.</p>
        </div>
      );
    }

    return (
        <div className="overflow-x-auto mt-6">
            <table className="min-w-full divide-y divide-gray-700 text-sm">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700/50 px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider z-10">
                            Mes
                        </th>
                        {zones.map(zone => (
                            <th key={zone} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                {zone}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {tableData.map((row) => (
                        <tr key={row.monthKey} className="hover:bg-gray-700/50">
                            <td className="sticky left-0 bg-gray-800 px-3 py-4 whitespace-nowrap font-medium text-gray-300 capitalize">{row.monthName}</td>
                            {zones.map(zone => (
                                <td key={zone} className="px-3 py-4 whitespace-nowrap text-center text-gray-300">
                                    {(row.zoneCounts[zone] || 0).toLocaleString('es-ES')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MonthlyEventCountsTable;
