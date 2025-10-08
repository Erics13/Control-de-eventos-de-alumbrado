import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { ZONE_ORDER } from '../constants';

interface EnergyData {
    name: string;
    consumo: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded-md shadow-lg text-sm">
        <p className="font-bold text-cyan-400">{label}</p>
        <p className="text-gray-300">{`${data.name}: ${data.value.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kWh`}</p>
      </div>
    );
  }
  return null;
};

const EnergyConsumptionByZoneChart: React.FC<{ data: EnergyData[] }> = ({ data }) => {
    
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            const indexA = ZONE_ORDER.indexOf(a.name);
            const indexB = ZONE_ORDER.indexOf(b.name);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [data]);

    if (sortedData.length === 0) {
      return (
        <>
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Consumo Diario Total por Zona (kWh)</h3>
            <div className="flex items-center justify-center h-full text-gray-500">No hay datos de consumo para mostrar.</div>
        </>
      );
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
             <h3 className="text-lg font-semibold text-cyan-400 mb-3">Consumo Diario Total por Zona (kWh)</h3>
            <ResponsiveContainer>
                <BarChart data={sortedData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="consumo" name="Consumo (kWh)" fill="#f59e0b" isAnimationActive={false}>
                        <LabelList dataKey="consumo" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} formatter={(value: number) => `${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}`} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default EnergyConsumptionByZoneChart;