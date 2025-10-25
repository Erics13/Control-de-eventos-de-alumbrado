
import React, { useState, useMemo } from 'react';

interface OperatingHoursSummary {
    range: string;
    total: number;
    [zone: string]: string | number;
}

interface OperatingHoursSummaryTableProps {
    data: OperatingHoursSummary[];
    zones: string[];
    onRowClick: (range: string) => void;
    selectedRange: string | null;
}

type SortKey = keyof OperatingHoursSummary | string;

const OperatingHoursSummaryTable: React.FC<OperatingHoursSummaryTableProps> = ({ data, zones, onRowClick, selectedRange }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'range', direction: 'ascending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedItems = useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const key = sortConfig.key;
                if (key === 'range') {
                    const getRangeStart = (rangeStr: string): number => {
                        if (rangeStr.startsWith('>')) return Infinity;
                        return parseInt(rangeStr.split(' ')[0].replace(/\D/g, ''), 10);
                    };
                    const valA = getRangeStart(a.range as string);
                    const valB = getRangeStart(b.range as string);
                    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }
                
                const valA = a[key] as number || 0;
                const valB = b[key] as number || 0;
                
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

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay datos de horas de funcionamiento para mostrar.</div>;
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('range')} className="flex items-center gap-2">
                                    Rango de Horas
                                    <span className="text-cyan-400">{getSortIndicator('range')}</span>
                                </button>
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                <button onClick={() => requestSort('total')} className="flex items-center gap-2">
                                    Total Luminarias
                                    <span className="text-cyan-400">{getSortIndicator('total')}</span>
                                </button>
                            </th>
                            {zones.map(zone => (
                                <th key={zone} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    <button onClick={() => requestSort(zone)} className="flex items-center gap-2">
                                        {zone}
                                        <span className="text-cyan-400">{getSortIndicator(zone)}</span>
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map((item) => (
                            <tr 
                                key={item.range}
                                onClick={() => onRowClick(item.range as string)}
                                className={`cursor-pointer transition-colors duration-150 ${
                                    selectedRange === item.range 
                                        ? 'bg-cyan-900/50' 
                                        : 'hover:bg-gray-700/50'
                                }`}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-300">{item.range}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-200">{item.total.toLocaleString()}</td>
                                 {zones.map(zone => (
                                     <td key={zone} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                         {((item[zone] as number) || 0).toLocaleString()}
                                     </td>
                                ))}
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
