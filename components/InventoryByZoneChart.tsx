

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import type { InventoryItem } from '../types';

const ZONE_ORDER = ['ZONA A', 'ZONA B', 'ZONA B1', 'ZONA B2', 'ZONA B3', 'ZONA C', 'ZONA D'];

const InventoryByZoneChart: React.FC<{ data: InventoryItem[] }> = ({ data }) => {
    const chartData = useMemo(() => {
        const zoneCounts = data.reduce((acc, item) => {
            if (item.zone) {
                acc[item.zone] = (acc[item.zone] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const unsortedData = Object.entries(zoneCounts).map(([name, value]) => ({ name, luminarias: value }));
        
        return unsortedData.sort((a, b) => {
            const indexA = ZONE_ORDER.indexOf(a.name);
            const indexB = ZONE_ORDER.indexOf(b.name);
            
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });

    }, [data]);
    
    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de inventario para mostrar.</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }}/>
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748' }}
                        labelStyle={{ color: '#E2E8F0' }}
                        itemStyle={{ color: '#E2E8F0' }}
                        cursor={{ fill: 'transparent' }}
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="luminarias" name="Nro de Luminarias" fill="#22c55e" isAnimationActive={false}>
                        <LabelList dataKey="luminarias" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default InventoryByZoneChart;