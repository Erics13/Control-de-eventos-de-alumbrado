import React, { useMemo } from 'react';

interface MonthlyData {
    name: string;
    LUMINARIA: number;
    OLC: number;
}

const ChangesByMonthTable: React.FC<{ data: MonthlyData[] }> = ({ data }) => {

    const totals = useMemo(() => {
        return data.reduce((acc, curr) => {
            const luminares = curr?.LUMINARIA || 0;
            const olcs = curr?.OLC || 0;
            acc.LUMINARIA += luminares;
            acc.OLC += olcs;
            acc.total += luminares + olcs;
            return acc;
        }, { LUMINARIA: 0, OLC: 0, total: 0 });
    }, [data]);

    if (data.length === 0) {
        return null; // El gráfico ya muestra el mensaje de "sin datos"
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mes</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cambios de Luminaria</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cambios de OLC</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total Mensual</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map((item) => (
                        <tr key={item.name} className="hover:bg-gray-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300 capitalize">{item.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(item.LUMINARIA || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(item.OLC || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-200">{((item.LUMINARIA || 0) + (item.OLC || 0)).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-700 font-bold">
                    <tr>
                        <td className="px-6 py-3 text-left text-sm text-gray-200 uppercase">Total Anual</td>
                        <td className="px-6 py-3 text-left text-sm text-cyan-300">{totals.LUMINARIA.toLocaleString()}</td>
                        <td className="px-6 py-3 text-left text-sm text-cyan-300">{totals.OLC.toLocaleString()}</td>
                        <td className="px-6 py-3 text-left text-sm text-cyan-300">{totals.total.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default ChangesByMonthTable;