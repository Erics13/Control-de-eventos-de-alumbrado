import React, { useMemo } from 'react';
import type { HistoricalData, HistoricalZoneData } from '../types';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { ZONE_ORDER } from '../constants';

interface HistoricalSummaryTableProps {
    historicalData: HistoricalData;
}

interface MonthlySummary {
    monthKey: string;
    monthName: string;
    date: Date;
    zoneAverages: Record<string, Omit<HistoricalZoneData, 'name' | 'totalInventario' | 'eventos' | string>>;
}

const getColorForPercentage = (percentage: number): string => {
    if (percentage > 5) return 'text-red-400';
    if (percentage > 3) return 'text-yellow-400';
    return 'text-gray-300';
};

const HistoricalSummaryTable: React.FC<HistoricalSummaryTableProps> = ({ historicalData }) => {
    
    const { tableData, zones } = useMemo(() => {
        if (!historicalData || Object.keys(historicalData).length === 0) {
            return { tableData: [], zones: [] };
        }

        // FIX: Replaced problematic Omit<> with an explicit type for monthly summaries.
        const monthlySummaries: Record<string, Record<string, {
            porcentaje: { total: number; count: number };
            porcentajeGabinete: { total: number; count: number };
            porcentajeVandalismo: { total: number; count: number };
            porcentajeReal: { total: number; count: number };
            eventos: { total: number; count: number };
            eventosGabinete: { total: number; count: number };
            eventosVandalismo: { total: number; count: number };
            eventosReales: { total: number; count: number };
        }>> = {};
        const presentZones = new Set<string>();

        Object.entries(historicalData).forEach(([dateStr, zonesData]) => {
            const monthKey = format(parse(dateStr, 'yyyy-MM-dd', new Date()), 'yyyy-MM');
            if (!monthlySummaries[monthKey]) monthlySummaries[monthKey] = {};

            Object.entries(zonesData).forEach(([zoneName, zoneData]) => {
                presentZones.add(zoneName);
                if (!monthlySummaries[monthKey][zoneName]) {
                     // FIX: Initialize object matching the explicit type above.
                     monthlySummaries[monthKey][zoneName] = {
                        porcentaje: { total: 0, count: 0 },
                        porcentajeGabinete: { total: 0, count: 0 },
                        porcentajeVandalismo: { total: 0, count: 0 },
                        porcentajeReal: { total: 0, count: 0 },
                        eventos: { total: 0, count: 0 },
                        eventosGabinete: { total: 0, count: 0 },
                        eventosVandalismo: { total: 0, count: 0 },
                        eventosReales: { total: 0, count: 0 },
                     };
                }
                const summary = monthlySummaries[monthKey][zoneName];
                // FIX: Accessing properties is now type-safe.
                summary.porcentaje.total += zoneData.porcentaje;
                summary.porcentajeGabinete.total += zoneData.porcentajeGabinete;
                summary.porcentajeVandalismo.total += zoneData.porcentajeVandalismo;
                summary.porcentajeReal.total += zoneData.porcentajeReal;
                summary.porcentaje.count++;
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

        const data: MonthlySummary[] = Object.entries(monthlySummaries).map(([monthKey, zoneAvgs]) => {
            const zoneAverages: any = {};
            sortedZones.forEach(zone => {
                const avgData = zoneAvgs[zone];
                // FIX: Accessing properties is now type-safe.
                zoneAverages[zone] = {
                    porcentaje: avgData && avgData.porcentaje.count > 0 ? avgData.porcentaje.total / avgData.porcentaje.count : 0,
                    porcentajeGabinete: avgData && avgData.porcentaje.count > 0 ? avgData.porcentajeGabinete.total / avgData.porcentaje.count : 0,
                    porcentajeVandalismo: avgData && avgData.porcentaje.count > 0 ? avgData.porcentajeVandalismo.total / avgData.porcentaje.count : 0,
                    porcentajeReal: avgData && avgData.porcentaje.count > 0 ? avgData.porcentajeReal.total / avgData.porcentaje.count : 0,
                };
            });
            return { 
                monthKey,
                monthName: format(parse(monthKey, 'yyyy-MM', new Date()), 'MMMM yyyy', { locale: es }),
                date: parse(monthKey, 'yyyy-MM', new Date()),
                zoneAverages,
            };
        });

        const sortedTableData = data.sort((a, b) => b.date.getTime() - a.date.getTime());

        return { tableData: sortedTableData, zones: sortedZones };
    }, [historicalData]);

    if (tableData.length === 0) {
      return null;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700 text-sm">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="sticky left-0 bg-gray-700/50 px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider z-10">Mes</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Zona</th>
                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">% Total</th>
                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">% Gabinete</th>
                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">% Vandalismo</th>
                        <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-cyan-300 uppercase tracking-wider">% Real</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {tableData.flatMap((row, rowIndex) => 
                        zones.map((zone, zoneIndex) => (
                            <tr key={`${row.monthKey}-${zone}`} className={`hover:bg-gray-700/50 ${zoneIndex > 0 ? 'border-t-0' : ''}`}>
                                {zoneIndex === 0 ? (
                                    <td rowSpan={zones.length} className="sticky left-0 bg-gray-800 px-3 py-4 whitespace-nowrap font-medium text-gray-300 capitalize border-t border-gray-700 align-top">
                                        {row.monthName}
                                    </td>
                                ) : null}
                                <td className="px-3 py-4 whitespace-nowrap font-medium text-gray-300">{zone}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-center text-gray-400">
                                    {(row.zoneAverages[zone]?.porcentaje || 0).toFixed(2)}%
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-center text-gray-400">
                                    {(row.zoneAverages[zone]?.porcentajeGabinete || 0).toFixed(2)}%
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-center text-gray-400">
                                    {(row.zoneAverages[zone]?.porcentajeVandalismo || 0).toFixed(2)}%
                                </td>
                                <td className={`px-3 py-4 whitespace-nowrap text-center font-bold ${getColorForPercentage(row.zoneAverages[zone]?.porcentajeReal || 0)}`}>
                                    {(row.zoneAverages[zone]?.porcentajeReal || 0).toFixed(2)}%
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default HistoricalSummaryTable;