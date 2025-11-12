
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import type { LuminaireEvent } from '../types';
import { getCategoryColor } from '../constants';

const SPECIAL_CATEGORIES_TO_EXCLUDE = ["Columna Caída", "Hurto", "Vandalizado"];

const FailureByCategoryChart: React.FC<{ data: LuminaireEvent[] }> = ({ data }) => {
    const chartData = useMemo(() => {
        // Exclude special categories and events without a category
        const eventsWithCategory = data.filter(e => 
            e.failureCategory && !SPECIAL_CATEGORIES_TO_EXCLUDE.includes(e.failureCategory)
        );
        
        const categoryCounts = eventsWithCategory.reduce((acc, event) => {
            if (event.failureCategory) {
                acc[event.failureCategory] = (acc[event.failureCategory] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(categoryCounts)
            // FIX: Cast value to number to ensure correct type inference for 'eventos'.
            .map(([name, value]) => ({ name, eventos: value as number }))
            .sort((a, b) => b.eventos - a.eventos);
    }, [data]);

    if (chartData.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de eventos para mostrar.</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748' }}
                        labelStyle={{ color: '#E2E8F0' }}
                        itemStyle={{ color: '#E2E8F0' }}
                        cursor={{ fill: 'transparent' }}
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="eventos" name="Número de Eventos" isAnimationActive={false}>
                       <LabelList dataKey="eventos" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} />
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