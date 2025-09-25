
import React, { useMemo } from 'react';
import type { InventoryItem } from '../types';
import { ALL_ZONES } from '../constants';

interface PowerSummaryTableProps {
    items: InventoryItem[];
    selectedZone: string;
}

const PowerSummaryTable: React.FC<PowerSummaryTableProps> = ({ items, selectedZone }) => {
    const { powerData, locationColumns, columnTotals, grandTotal } = useMemo(() => {
        if (items.length === 0) {
            return { powerData: [], locationColumns: [], columnTotals: {}, grandTotal: 0 };
        }

        const isGroupingByZone = selectedZone === 'all';

        // FIX: Explicitly type the Set generic and filter results to resolve type inference errors.
        const locationColumns: string[] = isGroupingByZone
            ? ALL_ZONES.filter(zone => items.some(item => item.zone === zone))
            : Array.from(new Set<string>(items.map(item => item.municipio).filter(Boolean))).sort();

        // FIX: Explicitly type the Set generic to correct the type inference for `powers`.
        const powers: number[] = Array.from(new Set<number>(items.map(item => item.potenciaNominal).filter((p): p is number => p != null))).sort((a, b) => a - b);
        
        const powerMap = new Map<number, Record<string, number>>();

        for (const item of items) {
            if (item.potenciaNominal != null) {
                if (!powerMap.has(item.potenciaNominal)) {
                    powerMap.set(item.potenciaNominal, {});
                }
                const powerRow = powerMap.get(item.potenciaNominal)!;
                const location = isGroupingByZone ? item.zone : item.municipio;
                if (location) {
                    powerRow[location] = (powerRow[location] || 0) + 1;
                }
            }
        }
        
        const powerData = powers.map(power => {
            const rowData = powerMap.get(power) || {};
            const total = locationColumns.reduce((sum, loc) => sum + (rowData[loc] || 0), 0);
            return {
                power: `${power}W`,
                ...rowData,
                total: total,
            };
        });
        
        const columnTotals: Record<string, number> = {};
        let grandTotal = 0;
        locationColumns.forEach(loc => {
            const total = powerData.reduce((sum, row) => sum + ((row as any)[loc] || 0), 0);
            columnTotals[loc] = total;
            grandTotal += total;
        });

        return { powerData, locationColumns, columnTotals, grandTotal };

    }, [items, selectedZone]);

    if (items.length === 0 || powerData.length === 0) {
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
