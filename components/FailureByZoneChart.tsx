
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface FailureData {
    name: string;
    porcentaje: number;
    eventos: number;
    totalInventario: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded-md shadow-lg text-sm">
        <p className="font-bold text-cyan-400">{label}</p>
        <p className="text-gray-300">{`Porcentaje de Fallas: ${data.porcentaje?.toFixed(2) ?? '0.00'}%`}</p>
        <p className="text-gray-400">{`Total Fallas: ${(data.eventos ?? 0).toLocaleString()}`}</p>
        <p className="text-gray-400">{`Total Inventario: ${(data.totalInventario ?? 0).toLocaleString()}`}</p>
      </div>
    );
  }

  return null;
};


interface FailureByZoneChartProps {
    data: FailureData[];
}

const FailureByZoneChart: React.FC<FailureByZoneChartProps> = ({ data }) => {
    
    if (data.length === 0) {
      return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de inventario para calcular porcentajes.</div>;
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12 }}/>
                    <YAxis stroke="#A0AEC0" tickFormatter={(tick) => `${tick}%`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(130, 200, 255, 0.1)' }} />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="porcentaje" name="% de Fallas" fill="#818CF8" isAnimationActive={false}>
                        <LabelList dataKey="porcentaje" position="top" style={{ fill: '#E2E8F0', fontSize: 12 }} formatter={(value: number) => `${value.toFixed(1)}%`} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default FailureByZoneChart;
