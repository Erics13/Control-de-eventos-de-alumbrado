
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoricalData, HistoricalZoneData } from '../types';
// FIX: The 'parse' and 'format' functions should be imported from their specific subpaths.
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { es } from 'date-fns/locale/es';
import { getZoneColor, ZONE_ORDER } from '../constants';

interface MonthlyEventSummaryChartProps {
    historicalData: HistoricalData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataKey = payload[0].dataKey;
    const monthData = payload[0].payload;
    const zoneData = monthData.originalData[dataKey];
    
    if (!zoneData) return null;

    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded-md shadow-lg text-sm">
        <p className="font-bold text-cyan-400">{`${label} - ${dataKey}`}</p>
        <p style={{ color: '#818CF8' }}>{`% Falla Real: ${zoneData.porcentajeReal.toFixed(2)}%`}</p>
        <hr className="border-gray-600 my-1" />
        <p className="text-gray-400">{`% Total: ${zoneData.porcentaje.toFixed(2)}%`}</p>
        <p className="text-gray-400">{`% Gabinete: ${zoneData.porcentajeGabinete.toFixed(2)}%`}</p>
        <p className="text-gray-400">{`% Vandalismo: ${zoneData.porcentajeVandalismo.toFixed(2)}%`}</p>
      </div>
    );
  }
  return null;
};

const MonthlyEventSummaryChart: React.FC<MonthlyEventSummaryChartProps> = ({ historicalData }) => {
    
    const { chartData, zones } = useMemo(() => {
        if (!historicalData || Object.keys(historicalData).length === 0) {
            return { chartData: [], zones: [] };
        }

        // FIX: Replaced problematic Omit<> with an explicit type for monthly averages.
        const monthlyAverages: Record<string, Record<string, {
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
            if (!monthlyAverages[monthKey]) monthlyAverages[monthKey] = {};

            Object.entries(zonesData).forEach(([zoneName, zoneData]) => {
                presentZones.add(zoneName);
                if (!monthlyAverages[monthKey][zoneName]) {
                     // FIX: Initialize object matching the explicit type above.
                     monthlyAverages[monthKey][zoneName] = {
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
                const summary = monthlyAverages[monthKey][zoneName];
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

        const data = Object.entries(monthlyAverages).map(([monthKey, zoneAvgs]) => {
            const monthData: { name: string; [key: string]: any } = {
                name: format(parse(monthKey, 'yyyy-MM', new Date()), 'MMM yyyy', { locale: es }),
                originalData: {}
            };

            sortedZones.forEach(zone => {
                const avgData = zoneAvgs[zone];
                const count = avgData ? avgData.porcentaje.count : 0;
                if (avgData && count > 0) {
                    monthData[zone] = avgData.porcentajeReal.total / count;
                    monthData.originalData[zone] = {
                        porcentaje: avgData.porcentaje.total / count,
                        porcentajeGabinete: avgData.porcentajeGabinete.total / count,
                        porcentajeVandalismo: avgData.porcentajeVandalismo.total / count,
                        porcentajeReal: avgData.porcentajeReal.total / count,
                    };
                } else {
                    monthData[zone] = 0;
                    monthData.originalData[zone] = {
                        porcentaje: 0,
                        porcentajeGabinete: 0,
                        porcentajeVandalismo: 0,
                        porcentajeReal: 0,
                    };
                }
            });
            
            return { ...monthData, date: parse(monthKey, 'yyyy-MM', new Date())};
        });

        const sortedChartData = data
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(-12) 
            .map(({date, ...rest}) => rest);

        return { chartData: sortedChartData, zones: sortedZones };
    }, [historicalData]);

    if (chartData.length === 0) {
      return (
            <div className="flex items-center justify-center h-80 text-gray-500">
                <p className="text-center">No hay suficientes datos históricos en Firebase para mostrar el promedio mensual.<br/>Los datos se guardarán y mostrarán aquí después de la próxima carga.</p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={50} />
                    <YAxis stroke="#A0AEC0" tickFormatter={(tick) => `${tick.toFixed(1)}%`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(130, 200, 255, 0.1)' }} />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px', paddingTop: '10px' }}/>
                    {zones.map(zone => (
                        <Bar 
                            key={zone} 
                            dataKey={zone} 
                            name={zone}
                            fill={getZoneColor(zone)} 
                            isAnimationActive={false}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MonthlyEventSummaryChart;