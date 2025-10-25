


import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { InventoryItem } from '../types';
import { format } from 'date-fns/format';
import { getZoneColor } from '../constants';

const InaugurationsByYearZoneChart: React.FC<{ data: InventoryItem[] }> = ({ data }) => {
    const { chartData, zones } = useMemo(() => {
        const inauguratedItems = data.filter(item => item.fechaInauguracion);
        if (inauguratedItems.length === 0) {
            return { chartData: [], zones: [] };
        }

        const countsByYearAndZone = inauguratedItems.reduce((acc, item) => {
            // '!': Asserting that fechaInauguracion is not null, filtered above
            const year = format(item.fechaInauguracion!, 'yyyy');
            if (!acc[year]) {
                acc[year] = {};
            }
            if (item.zone) {
                acc[year][item.zone] = (acc[year][item.zone] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, Record<string, number>>);

        const allZones = Array.from(new Set(inauguratedItems.map(item => item.zone).filter((z): z is string => !!z))).sort();
        
        const finalChartData = Object.entries(countsByYearAndZone)
            .map(([year, zoneCounts]) => ({
                year,
                // FIX: Cast 'zoneCounts' to its expected type to resolve spread operator error.
                ...(zoneCounts as Record<string, number>)
            }))
            .sort((a, b) => a.year.localeCompare(b.year));

        return { chartData: finalChartData, zones: allZones };
    }, [data]);

    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de inauguraciones por año para mostrar.</div>;
    }

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="year" stroke="#A0AEC0" />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748' }}
                        labelStyle={{ color: '#E2E8F0' }}
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0' }} />
                    {zones.map(zone => (
                        <Bar 
                            key={zone} 
                            dataKey={zone} 
                            stackId="a" 
                            fill={getZoneColor(zone)}
                            name={zone}
                            isAnimationActive={false}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default InaugurationsByYearZoneChart;