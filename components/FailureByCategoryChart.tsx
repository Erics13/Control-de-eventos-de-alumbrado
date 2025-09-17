
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import type { LuminaireEvent } from '../types';
import { getCategoryColor } from '../constants';

const FailureByCategoryChart: React.FC<{ data: LuminaireEvent[] }> = ({ data }) => {
    const chartData = useMemo(() => {
        const failures = data.filter(e => e.status === 'FAILURE' && e.failureCategory);
        const categoryCounts = failures.reduce((acc, event) => {
            if (event.failureCategory) {
                acc[event.failureCategory] = (acc[event.failureCategory] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categoryCounts).map(([name, value]) => ({ name, fallas: value }));
    }, [data]);

    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de fallas para mostrar.</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748' }}
                        labelStyle={{ color: '#E2E8F0' }}
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="fallas" name="Número de Fallas" fill="#2DD4BF">
                       {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default FailureByCategoryChart;
