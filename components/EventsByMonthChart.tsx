import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import type { LuminaireEvent } from '../types';
import { format } from 'date-fns/format';
import { es } from 'date-fns/locale/es';
import { parse } from 'date-fns/parse';

interface EventsByMonthChartProps {
    data: LuminaireEvent[];
}

const EventsByMonthChart: React.FC<EventsByMonthChartProps> = ({ data }) => {
    const chartData = useMemo(() => {
        if (data.length === 0) {
            return [];
        }

        const monthCounts = data.reduce((acc, event) => {
            const monthKey = format(event.date, 'yyyy-MM');
            acc[monthKey] = (acc[monthKey] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const unsortedData = Object.entries(monthCounts).map(([monthKey, value]) => {
            const date = parse(monthKey, 'yyyy-MM', new Date());
            return {
                name: format(date, 'MMM yyyy', { locale: es }),
                eventos: value,
                date: date
            };
        });

        // Sort chronologically
        return unsortedData.sort((a, b) => a.date.getTime() - b.date.getTime());

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
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="eventos" name="Total de Eventos" fill="#14b8a6" isAnimationActive={false}>
                        <LabelList dataKey="eventos" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default EventsByMonthChart;