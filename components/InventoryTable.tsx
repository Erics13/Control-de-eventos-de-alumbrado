import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../types';

const InventoryTable: React.FC<{ items: InventoryItem[] }> = ({ items }) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof InventoryItem; direction: 'ascending' | 'descending' } | null>({ key: 'municipio', direction: 'ascending' });
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

    const requestSort = (key: keyof InventoryItem) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const getSortIndicator = (key: keyof InventoryItem) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };
    
    const columns: { key: keyof InventoryItem; label: string }[] = [
        { key: 'streetlightIdExterno', label: 'ID Externo' },
        { key: 'municipio', label: 'Municipio' },
        { key: 'zone', label: 'Zona' },
        { key: 'potenciaNominal', label: 'Potencia (W)' },
        { key: 'dimmingCalendar', label: 'Calendario' },
        { key: 'horasFuncionamiento', label: 'Horas Func.' },
        { key: 'fechaInstalacion', label: 'Fecha Instalación' },
        { key: 'fechaInauguracion', label: 'Fecha Inauguración' },
        { key: 'estado', label: 'Estado' },
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
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedItems.map((item) => (
                            <tr key={item.streetlightIdExterno} className="hover:bg-gray-700/50">
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.streetlightIdExterno}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.municipio}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.zone}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.potenciaNominal ?? 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.dimmingCalendar || 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.horasFuncionamiento?.toLocaleString() ?? 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.fechaInstalacion?.toLocaleDateString() || 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{item.fechaInauguracion?.toLocaleDateString() || 'N/A'}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.estado?.toLowerCase() === 'conectado' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                                        {item.estado || 'N/A'}
                                    </span>
                                </td>
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

export default InventoryTable;