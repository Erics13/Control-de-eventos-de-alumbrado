
import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../types';

interface LuminaireDetailTableProps {
    items: InventoryItem[];
}

type SortKey = keyof InventoryItem;

const LuminaireDetailTable: React.FC<LuminaireDetailTableProps> = ({ items }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'municipio', direction: 'ascending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
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
    }, [items, sortConfig]);

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
    
    const handleMapClick = (item: InventoryItem) => {
        if (item.lat && item.lon) {
            const url = `https://www.google.com/maps?q=${item.lat},${item.lon}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const columns: { key: SortKey; label: string }[] = [
        { key: 'streetlightIdExterno', label: 'ID Luminaria' },
        { key: 'olcHardwareDir', label: 'Dirección Hardware OLC' },
        { key: 'municipio', label: 'Municipio' },
        { key: 'lat', label: 'Latitud' },
        { key: 'lon', label: 'Longitud' },
    ];

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            {columns.map(({key, label}) => (
                                <th key={key} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                    <button onClick={() => requestSort(key)} className="flex items-center gap-2">
                                        {label}
                                        <span className="text-cyan-400">{getSortIndicator(key)}</span>
                                    </button>
                                </th>
                            ))}
                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Mapa
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map((item) => {
                            const hasLocation = item.lat != null && item.lon != null;
                            return (
                                <tr key={item.streetlightIdExterno} className="hover:bg-gray-700/50 transition-colors duration-150">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.streetlightIdExterno}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.olcHardwareDir ?? 'N/A'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.municipio}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.lat ?? 'N/A'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.lon ?? 'N/A'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                        {hasLocation ? (
                                            <button
                                                onClick={() => handleMapClick(item)}
                                                className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded-full transition-colors"
                                                title={`Ver ubicación de ${item.streetlightIdExterno} en el mapa`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                                </svg>
                                                <span className="sr-only">Ver en mapa</span>
                                            </button>
                                        ) : null}
                                    </td>
                                </tr>
                            );
                        })}
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

export default LuminaireDetailTable;
