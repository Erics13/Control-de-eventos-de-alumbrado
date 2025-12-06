
import React, { useState, useMemo } from 'react';
import type { CabinetFailureDetail } from '../types';

interface CabinetFailuresTableProps {
    data: CabinetFailureDetail[];
}

type SortKey = keyof CabinetFailureDetail;

const CabinetFailuresTable: React.FC<CabinetFailuresTableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedItems = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];
                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
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
        { key: 'date', label: 'Fecha de Falla' },
        { key: 'id', label: 'ID Luminaria' },
        { key: 'zone', label: 'Zona' },
        { key: 'municipio', label: 'Municipio' },
    ];

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500 rounded-lg bg-gray-800/50">No hay luminarias en falla de gabinete para mostrar con los filtros actuales.</div>;
    }

    return (
        <div>
            <div className="overflow-x-auto border border-gray-700 rounded-lg">
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
                            <tr key={`${item.id}-${item.date.toISOString()}`} className="hover:bg-gray-700/50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{item.date.toLocaleDateString('es-ES')}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{item.id}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{item.zone}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{item.municipio}</td>
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

export default CabinetFailuresTable;
