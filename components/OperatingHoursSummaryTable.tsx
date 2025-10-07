
import React, { useState, useMemo } from 'react';

interface OperatingHoursSummary {
    range: string;
    count: number;
}

interface OperatingHoursSummaryTableProps {
    data: OperatingHoursSummary[];
}

type SortKey = keyof OperatingHoursSummary;

const OperatingHoursSummaryTable: React.FC<OperatingHoursSummaryTableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'range', direction: 'ascending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedItems = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                if (sortConfig.key === 'range') {
                    // Sort numerically based on the start of the range
                    const valA = parseInt(a.range.split(' ')[0].replace(/,/g, ''));
                    const valB = parseInt(b.range.split(' ')[0].replace(/,/g, ''));
                    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }
                // Sort by count
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
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
        { key: 'range', label: 'Rango de Horas' },
        { key: 'count', label: 'Cantidad de Luminarias' },
    ];

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay datos de horas de funcionamiento para mostrar.</div>;
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            {columns.map(({ key, label }) => (
                                <th key={key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
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
                            <tr key={item.range} className="hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">{item.range}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.count.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {totalPages > 1 && (
                <div className="py-3 flex items-center justify-between border-t border-gray-700 mt-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Anterior</button>
                    <span className="text-sm text-gray-400">Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 disabled:opacity-50">Siguiente</button>
                </div>
            )}
        </div>
    );
};

export default OperatingHoursSummaryTable;
