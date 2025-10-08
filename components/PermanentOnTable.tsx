
import React, { useState, useMemo } from 'react';

export interface PermanentOnResult {
    streetlightIdExterno: string;
    municipio: string;
    zone: string;
    potenciaNominal?: number;
    olcIdExterno?: number;
    avgPower: number;
    deltaKwh: number;
    deltaHours: number;
    prevDate: Date;
    currDate: Date;
}

interface PermanentOnTableProps {
    data: PermanentOnResult[];
}

type SortKey = keyof PermanentOnResult;

const PermanentOnTable: React.FC<PermanentOnTableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'avgPower', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedItems = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA == null) return 1;
                if (valB == null) return -1;
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedItems.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedItems, currentPage]);

    const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

    const requestSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const columns: { key: SortKey; label: string }[] = [
        { key: 'streetlightIdExterno', label: 'ID Luminaria' },
        { key: 'municipio', label: 'Municipio' },
        { key: 'zone', label: 'Zona' },
        { key: 'olcIdExterno', label: 'ID OLC' },
        { key: 'potenciaNominal', label: 'Pot. Nominal (W)' },
        { key: 'avgPower', label: 'Pot. Calculada (W)' },
        { key: 'deltaKwh', label: 'Consumo (kWh)' },
        { key: 'deltaHours', label: 'Horas' },
        { key: 'prevDate', label: 'Fecha Anterior' },
        { key: 'currDate', label: 'Fecha Actual' },
    ];

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay luminarias con consumo excesivo para mostrar. Cargue un respaldo anterior y un archivo de energía actual para realizar el análisis.</div>;
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            {columns.map(({ key, label }) => (
                                <th key={key} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    <button onClick={() => requestSort(key)} className="flex items-center gap-2">
                                        {label}
                                        <span className="text-cyan-400">{getSortIndicator(key)}</span>
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map((item) => (
                            <tr key={`${item.streetlightIdExterno}-${item.olcIdExterno}`} className="hover:bg-gray-700/50">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.streetlightIdExterno}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.municipio}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.zone}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.olcIdExterno ?? 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.potenciaNominal?.toFixed(0) ?? 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-red-400">{item.avgPower.toFixed(2)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.deltaKwh.toFixed(3)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.deltaHours.toFixed(2)}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.prevDate.toLocaleString()}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.currDate.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="py-3 flex items-center justify-between border-t border-gray-700 mt-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Anterior</button>
                    <span className="text-sm text-gray-400">Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Siguiente</button>
                </div>
            )}
        </div>
    );
};

export default PermanentOnTable;
