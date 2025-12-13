
import React, { useState, useMemo } from 'react';

interface ChangeSummary {
    name: string; // Municipio name
    LUMINARIA: number;
    OLC: number;
    total: number;
}

interface ChangesByMunicipioTableProps {
    data: ChangeSummary[];
}

type SortKey = keyof ChangeSummary;

export const ChangesByMunicipioTable: React.FC<ChangesByMunicipioTableProps> = ({ data }) => { // Changed to named export
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'total', direction: 'descending' });
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
        setCurrentPage(1); // Reset to first page on sort
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const totals = useMemo(() => {
        return data.reduce((acc, item) => {
            acc.LUMINARIA += item.LUMINARIA;
            acc.OLC += item.OLC;
            acc.total += item.total;
            return acc;
        }, { name: 'Total General', LUMINARIA: 0, OLC: 0, total: 0 });
    }, [data]);

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay datos de cambios por municipio para mostrar.</div>;
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('name')} className="flex items-center gap-2">
                                    Municipio
                                    <span className="text-cyan-400">{getSortIndicator('name')}</span>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('LUMINARIA')} className="flex items-center gap-2">
                                    Luminaria
                                    <span className="text-cyan-400">{getSortIndicator('LUMINARIA')}</span>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('OLC')} className="flex items-center gap-2">
                                    OLC
                                    <span className="text-cyan-400">{getSortIndicator('OLC')}</span>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('total')} className="flex items-center gap-2">
                                    Total
                                    <span className="text-cyan-400">{getSortIndicator('total')}</span>
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map((item) => (
                            <tr key={item.name} className="hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">{item.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(item.LUMINARIA ?? 0).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{(item.OLC ?? 0).toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-200">{(item.total ?? 0).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-gray-700 font-bold">
                        <tr>
                            <td className="px-6 py-3 text-left text-sm text-gray-200 uppercase">{totals.name}</td>
                            <td className="px-6 py-3 text-left text-sm text-cyan-300">{(totals.LUMINARIA ?? 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-left text-sm text-cyan-300">{(totals.OLC ?? 0).toLocaleString()}</td>
                            <td className="px-6 py-3 text-left text-sm text-cyan-300">{(totals.total ?? 0).toLocaleString()}</td>
                        </tr>
                    </tfoot>
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
