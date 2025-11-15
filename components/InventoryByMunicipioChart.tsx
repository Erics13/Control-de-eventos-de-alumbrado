import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import type { InventoryItem } from '../types';

const InventoryByMunicipioChart: React.FC<{ data: InventoryItem[] }> = ({ data }) => {
    const chartData = useMemo(() => {
        const municipioCounts = data.reduce((acc, item) => {
            if(item.municipio) {
                acc[item.municipio] = (acc[item.municipio] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(municipioCounts)
            // FIX: Cast value to number to ensure correct type inference for 'luminarias'.
            .map(([name, value]) => ({ name, luminarias: value as number }))
            .sort((a, b) => b.luminarias - a.luminarias);
    }, [data]);
    
    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de inventario para mostrar.</div>;
    }

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748' }}
                        labelStyle={{ color: '#E2E8F0' }}
                        itemStyle={{ color: '#E2E8F0' }}
                        cursor={{ fill: 'transparent' }}
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="luminarias" name="Nro de Luminarias" fill="#d946ef" isAnimationActive={false}>
                        <LabelList dataKey="luminarias" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default InventoryByMunicipioChart;