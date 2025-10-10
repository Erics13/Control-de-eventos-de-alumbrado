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
                                {columns.map(({ key }) => (
                                    <td key={key} className={`px-4 py-4 whitespace-nowrap text-sm ${key === 'name' ? 'font-medium text-gray-300' : 'text-gray-400'}`}>
                                        {key === 'porcentaje' ? `${item.porcentaje.toFixed(2)}%` : (item[key] ?? 0).toLocaleString()}
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

export default FailurePercentageTable;