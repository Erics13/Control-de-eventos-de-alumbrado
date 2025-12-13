
import React, { useState, useMemo } from 'react';

interface FailureData {
    name: string;
    porcentaje: number;
    eventos: number;
    totalInventario: number;
    [key: string]: any; // For dynamic category keys
}

interface FailurePercentageTableProps {
    data: FailureData[];
    categories: string[];
    locationHeader: 'Zona' | 'Municipio';
}

type SortKey = keyof FailureData | string;

const FailurePercentageTable: React.FC<FailurePercentageTableProps> = ({ data, categories, locationHeader }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'porcentaje', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const columns = useMemo(() => {
        const staticColumns: { key: SortKey, label: string }[] = [
            { key: 'name', label: locationHeader },
            { key: 'porcentaje', label: 'Fallas (%)' },
            { key: 'eventos', label: 'Total Fallas' },
            { key: 'totalInventario', label: 'Total Inventario' },
        ];
        const dynamicColumns: { key: SortKey, label: string }[] = categories.map(cat => ({
            key: cat,
            label: cat
        }));
        return [...staticColumns, ...dynamicColumns];
    }, [locationHeader, categories]);


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

    const totals = useMemo(() => {
        if (!data || data.length === 0) {
            return null;
        }

        const initialTotals: { [key: string]: any } = {
            name: 'Total General',
            eventos: 0,
            totalInventario: 0,
            porcentaje: 0,
            ...categories.reduce((acc, cat) => ({ ...acc, [cat]: 0 }), {})
        };

        const calculatedTotals = data.reduce((acc, item) => {
            acc.eventos += item.eventos || 0;
            acc.totalInventario += item.totalInventario || 0;
            categories.forEach(cat => {
                acc[cat] += item[cat] || 0;
            });
            return acc;
        }, initialTotals);

        calculatedTotals.porcentaje = calculatedTotals.totalInventario > 0
            ? (calculatedTotals.eventos / calculatedTotals.totalInventario) * 100
            : 0;

        return calculatedTotals;
    }, [data, categories]);

    // Helper function for conditional styling
    const getPercentageColorClass = (percentage: number) => {
        if (percentage > 5) return 'text-red-400 font-bold';
        if (percentage > 3) return 'text-yellow-400 font-bold';
        return 'text-gray-400';
    };

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500">No hay datos de fallas para mostrar con los filtros actuales.</div>;
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            {columns.map(({ key, label }) => (
                                <th key={key} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    <button onClick={() => requestSort(key)} className="flex items-center gap-1">
                                        {label}
                                        <span className="text-cyan-400">{getSortIndicator(key)}</span>
                                    </button>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map((item) => (
                             <tr key={item.name} className="hover:bg-gray-700/50">
                                {columns.map(({ key }) => {
                                    let cellClass = "px-4 py-4 whitespace-nowrap text-sm ";
                                    if (key === 'name') {
                                        cellClass += "font-medium text-gray-300";
                                    } else if (key === 'porcentaje') {
                                        cellClass += getPercentageColorClass(item.porcentaje);
                                    } else {
                                        cellClass += "text-gray-400";
                                    }

                                    return (
                                        <td key={key} className={cellClass}>
                                            {key === 'porcentaje' ? `${item.porcentaje.toFixed(2)}%` : (item[key] ?? 0).toLocaleString()}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                     {totals && (
                        <tfoot className="bg-gray-700/50 font-bold">
                            <tr>
                                {columns.map(({ key }) => {
                                    let footerClass = "px-4 py-3 whitespace-nowrap text-sm border-t-2 border-gray-600 ";
                                    if (key === 'name') {
                                        footerClass += "text-gray-200";
                                    } else if (key === 'porcentaje') {
                                        // Apply same logic to footer
                                        const pct = totals.porcentaje || 0;
                                        if (pct > 5) footerClass += "text-red-400 font-bold";
                                        else if (pct > 3) footerClass += "text-yellow-400 font-bold";
                                        else footerClass += "text-cyan-300";
                                    } else {
                                        footerClass += "text-cyan-300";
                                    }

                                    return (
                                        <td key={`total-${key}`} className={footerClass}>
                                            {key === 'name' 
                                                ? totals.name 
                                                : key === 'porcentaje' 
                                                    ? `${totals.porcentaje.toFixed(2)}%` 
                                                    : (totals[key] ?? 0).toLocaleString()
                                            }
                                        </td>
                                    );
                                })}
                            </tr>
                        </tfoot>
                    )}
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

export default FailurePercentageTable;
