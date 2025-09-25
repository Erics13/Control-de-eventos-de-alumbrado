
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import type { ChangeEvent } from '../types';

const ZONE_ORDER = ['ZONA A', 'ZONA B', 'ZONA B1', 'ZONA B2', 'ZONA B3', 'ZONA C', 'ZONA D'];

const ChangesByZoneChart: React.FC<{ data: ChangeEvent[] }> = ({ data }) => {
    const chartData = useMemo(() => {
        const countsByZone = data.reduce((acc, event) => {
            const zone = event.zone;
            if (!acc[zone]) {
                acc[zone] = { LUMINARIA: 0, OLC: 0 };
            }
            const component = event.componente.toUpperCase();
            if (component.includes('LUMINARIA')) {
                acc[zone].LUMINARIA++;
            } else if (component.includes('OLC')) {
                acc[zone].OLC++;
            }
            return acc;
        }, {} as Record<string, { LUMINARIA: number; OLC: number }>);

        const unsortedData = Object.entries(countsByZone).map(([zoneName, counts]) => ({
            name: zoneName,
            ...counts
        }));
        
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
      return <div className="flex items-center justify-center h-80 text-gray-500">No hay datos de cambios para mostrar con los filtros actuales.</div>;
    }

    return (
        <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }}/>
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #2D3748' }}
                        labelStyle={{ color: '#E2E8F0' }}
                    />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="LUMINARIA" name="Luminarias" fill="#3b82f6">
                        <LabelList dataKey="LUMINARIA" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} />
                    </Bar>
                    <Bar dataKey="OLC" name="OLCs" fill="#14b8a6">
                        <LabelList dataKey="OLC" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ChangesByZoneChart;
