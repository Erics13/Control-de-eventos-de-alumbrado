

import React from 'react';

interface PowerSummaryData {
    powerData: { power: string; total: number; [key: string]: any }[];
    locationColumns: string[];
    columnTotals: Record<string, number>;
    grandTotal: number;
}

interface PowerSummaryTableProps {
    summaryData: PowerSummaryData;
}

const PowerSummaryTable: React.FC<PowerSummaryTableProps> = ({ summaryData }) => {
    const { powerData, locationColumns, columnTotals, grandTotal } = summaryData;

    if (powerData.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay datos de potencias para mostrar.</div>;
    }
    
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700 text-sm">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700/50 px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider z-10">
                            Potencia
                        </th>
                        {locationColumns.map(loc => (
                            <th key={loc} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                {loc}
                            </th>
                        ))}
                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {powerData.map((row) => (
                        <tr key={row.power} className="hover:bg-gray-700/50">
                            <td className="sticky left-0 bg-gray-800 px-3 py-4 whitespace-nowrap font-medium text-cyan-300">{row.power}</td>
                            {locationColumns.map(loc => (
                                <td key={loc} className="px-3 py-4 whitespace-nowrap text-center text-gray-300">
                                    {(row as any)[loc] || 0}
                                </td>
                            ))}
                            <td className="px-3 py-4 whitespace-nowrap text-center font-bold text-gray-200">{row.total}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-700/50">
                     <tr>
                         <th scope="row" className="sticky left-0 bg-gray-700/50 px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider z-10">Total General</th>
                         {locationColumns.map(loc => (
                             <td key={loc} className="px-3 py-3 whitespace-nowrap text-center font-bold text-gray-200">
                                 {columnTotals[loc] || 0}
                             </td>
                         ))}
                         <td className="px-3 py-3 whitespace-nowrap text-center font-extrabold text-cyan-300">{grandTotal}</td>
                     </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default PowerSummaryTable;