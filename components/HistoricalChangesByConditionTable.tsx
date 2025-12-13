
import React from 'react';

interface HistoricalData {
    year: string;
    garantiaLuminaria: number;
    garantiaOlc: number;
    columnaCaidaLuminaria: number;
    columnaCaidaOlc: number;
    hurtoLuminaria: number;
    hurtoOlc: number;
    vandalizadoLuminaria: number;
    vandalizadoOlc: number;
}

const HistoricalChangesByConditionTable: React.FC<{ data: HistoricalData[] }> = ({ data }) => {
    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay datos históricos de cambios por condición para mostrar.</div>;
    }
    
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left text-gray-300">
                <thead className="bg-gray-700/50 text-xs text-gray-300 uppercase">
                    <tr>
                        <th rowSpan={2} className="px-4 py-3 text-left font-medium tracking-wider border-r border-b border-gray-600 align-middle">Año</th>
                        <th colSpan={2} className="px-4 py-3 text-center font-medium tracking-wider border-r border-b border-gray-600">Por Garantía</th>
                        <th colSpan={2} className="px-4 py-3 text-center font-medium tracking-wider border-r border-b border-gray-600">Por Columna Caída</th>
                        <th colSpan={2} className="px-4 py-3 text-center font-medium tracking-wider border-r border-b border-gray-600">Por Hurto</th>
                        <th colSpan={2} className="px-4 py-3 text-center font-medium tracking-wider border-r border-b border-gray-600">Por Vandalismo</th>
                        <th colSpan={2} className="px-4 py-3 text-center font-medium tracking-wider border-b border-gray-600">Total General</th>
                    </tr>
                    <tr>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">Luminarias</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">OLCs</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">Luminarias</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">OLCs</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">Luminarias</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">OLCs</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">Luminarias</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">OLCs</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider border-r border-gray-600 bg-gray-700">Luminarias</th>
                        <th className="px-4 py-3 text-center font-medium tracking-wider bg-gray-700">OLCs</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map(item => {
                        const totalLuminarias = (item.garantiaLuminaria || 0) + (item.columnaCaidaLuminaria || 0) + (item.hurtoLuminaria || 0) + (item.vandalizadoLuminaria || 0);
                        const totalOlcs = (item.garantiaOlc || 0) + (item.columnaCaidaOlc || 0) + (item.hurtoOlc || 0) + (item.vandalizadoOlc || 0);
                        return (
                            <tr key={item.year} className="hover:bg-gray-700/50">
                                <td className="px-4 py-3 font-medium text-gray-200 border-r border-gray-600">{item.year}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.garantiaLuminaria ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.garantiaOlc ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.columnaCaidaLuminaria ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.columnaCaidaOlc ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.hurtoLuminaria ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.hurtoOlc ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.vandalizadoLuminaria ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center border-r border-gray-600">{(item.vandalizadoOlc ?? 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-center font-bold text-cyan-300 border-r border-gray-600">{totalLuminarias.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center font-bold text-cyan-300">{totalOlcs.toLocaleString()}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default HistoricalChangesByConditionTable;
