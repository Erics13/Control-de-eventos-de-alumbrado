import React, { useMemo } from 'react';
import type { HistoricalData } from '../types';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ZONE_ORDER } from '../constants';

interface MonthlyEventCountsTableProps {
    historicalData: HistoricalData;
}

interface MonthlyCountsSummary {
    monthKey: string;
    monthName: string;
    date: Date;
    zoneCounts: Record<string, number>;
}

const MonthlyEventCountsTable: React.FC<MonthlyEventCountsTableProps> = ({ historicalData }) => {
    
    const { tableData, zones } = useMemo(() => {
        if (!historicalData || Object.keys(historicalData).length === 0) {
            return { tableData: [], zones: [] };
        }

        const monthlyCounts: Record<string, Record<string, number>> = {};
        const presentZones = new Set<string>();

        Object.entries(historicalData).forEach(([dateStr, zonesData]) => {
            const monthKey = format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'yyyy-MM');
            if (!monthlyCounts[monthKey]) {
                monthlyCounts[monthKey] = {};
            }

            Object.entries(zonesData).forEach(([zoneName, zoneData]) => {
                presentZones.add(zoneName);
                if (!monthlyCounts[monthKey][zoneName]) {
                    monthlyCounts[monthKey][zoneName] = 0;
                }
                // Sum the 'eventos' (total events) for each day in the month
                monthlyCounts[monthKey][zoneName] += zoneData.eventos;
            });
        });
        
        const sortedZones = Array.from(presentZones).sort((a, b) => {
            const iA = ZONE_ORDER.indexOf(a);
            const iB = ZONE_ORDER.indexOf(b);
            if (iA !== -1 && iB !== -1) return iA - iB;
            if (iA !== -1) return -1;
            if (iB !== -1) return 1;
            return a.localeCompare(b);
        });

        const data: MonthlyCountsSummary[] = Object.entries(monthlyCounts).map(([monthKey, zoneCounts]) => {
            return { 
                monthKey,
                monthName: format(parse(monthKey, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es }),
                date: parse(monthKey, 'yyyy-MM', new Date()),
                zoneCounts,
            };
        });

        // Sort by date, newest first
        const sortedTableData = data.sort((a, b) => b.date.getTime() - a.date.getTime());

        return { tableData: sortedTableData, zones: sortedZones };
    }, [historicalData]);

    if (tableData.length === 0) {
      return null;
    }

    return (
        <div className="overflow-x-auto mt-6">
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Cantidad de Eventos de Falla por Mes</h3>
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
