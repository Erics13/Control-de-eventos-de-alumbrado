
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

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

const EnergyConsumptionByMunicipioChart: React.FC<{ data: EnergyData[] }> = ({ data }) => {
    
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => b.consumo - a.consumo);
    }, [data]);

    if (sortedData.length === 0) {
      return (
        <>
            <h3 className="text-lg font-semibold text-cyan-400 mb-3">Consumo Diario Total por Municipio (kWh)</h3>
            <div className="flex items-center justify-center h-full text-gray-500">No hay datos de consumo para mostrar.</div>
        </>
      );
    }

    return (
        <div style={{ width: '100%', height: 400 }}>
             <h3 className="text-lg font-semibold text-cyan-400 mb-3">Consumo Diario Total por Municipio (kWh)</h3>
            <ResponsiveContainer>
                <BarChart data={sortedData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} interval={0} />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="consumo" name="Consumo (kWh)" fill="#ef4444" isAnimationActive={false}>
                        <LabelList 
                            dataKey="consumo" 
                            position="top" 
                            style={{ fill: '#E2E8F0', fontSize: 10 }} 
                            formatter={(value: number) => value > 10 ? `${value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}` : ''}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default EnergyConsumptionByMunicipioChart;