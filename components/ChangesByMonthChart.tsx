import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface ChartData {
    name: string;
    LUMINARIA: number;
    OLC: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
    return (
      <div className="bg-gray-800 border border-gray-700 p-3 rounded-md shadow-lg text-sm">
        <p className="font-bold text-cyan-400 capitalize">{label}</p>
        <p style={{ color: '#3b82f6' }}>{`Luminarias: ${payload.find((p: any) => p.dataKey === 'LUMINARIA')?.value || 0}`}</p>
        <p style={{ color: '#14b8a6' }}>{`OLCs: ${payload.find((p: any) => p.dataKey === 'OLC')?.value || 0}`}</p>
        <hr className="my-1 border-gray-600" />
        <p className="font-semibold text-gray-300">{`Total: ${total}`}</p>
      </div>
    );
  }
  return null;
};


const ChangesByMonthChart: React.FC<{ data: ChartData[] }> = ({ data }) => {
    
    if (data.length === 0) {
      return <div className="flex items-center justify-center h-80 text-gray-500">No hay datos de cambios para el año seleccionado.</div>;
    }

    return (
        <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="name" stroke="#A0AEC0" tick={{ fontSize: 12, textTransform: 'capitalize' }} />
                    <YAxis stroke="#A0AEC0" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(130, 200, 255, 0.1)' }} />
                    <Legend wrapperStyle={{ color: '#E2E8F0', fontSize: '14px' }}/>
                    <Bar dataKey="LUMINARIA" name="Luminarias" stackId="a" fill="#3b82f6" isAnimationActive={false} />
                    <Bar dataKey="OLC" name="OLCs" stackId="a" fill="#14b8a6" isAnimationActive={false}>
                        <LabelList 
                            position="top" 
                            style={{ fill: '#E2E8F0', fontSize: 12 }} 
                            formatter={(value: number, entry: any) => {
                                const total = (entry?.LUMINARIA || 0) + value;
                                return total > 0 ? total : '';
                            }} 
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
export default ChangesByMonthChart;