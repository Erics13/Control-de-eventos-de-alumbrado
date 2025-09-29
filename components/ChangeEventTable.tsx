import React, { useState, useMemo } from 'react';
import type { ChangeEvent } from '../types';

const ChangeEventTable: React.FC<{ events: ChangeEvent[] }> = ({ events }) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof ChangeEvent; direction: 'ascending' | 'descending' } | null>({ key: 'fechaRetiro', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedEvents = useMemo(() => {
        let sortableItems = [...events];
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
    }, [events, sortConfig]);

    const paginatedEvents = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedEvents.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedEvents, currentPage]);

    const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);

    const requestSort = (key: keyof ChangeEvent) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1); // Reset to first page on sort
    };

    const getSortIndicator = (key: keyof ChangeEvent) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    const handleRowClick = (event: ChangeEvent) => {
        if (event.lat && event.lon) {
            const url = `https://www.google.com/maps?q=${event.lat},${event.lon}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };
    
    const columns: { key: keyof ChangeEvent; label: string }[] = [
        { key: 'fechaRetiro', label: 'Fecha Retiro' },
        { key: 'componente', label: 'Componente' },
        { key: 'poleIdExterno', label: 'ID Poste' },
        { key: 'streetlightIdExterno', label: 'ID Luminaria' },
        { key: 'municipio', label: 'Municipio' },
        { key: 'zone', label: 'Zona' },
        { key: 'condicion', label: 'Condición' },
        { key: 'horasFuncionamiento', label: 'Horas Func.' },
        { key: 'recuentoConmutacion', label: 'Conmutaciones' },
        { key: 'designacionTipo', label: 'Designación' },
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
                        {paginatedEvents.map((event) => {
                            const isClickable = event.lat != null && event.lon != null;
                            return (
                                <tr 
                                    key={event.uniqueId}
                                    onClick={() => handleRowClick(event)}
                                    className={`${isClickable ? 'cursor-pointer hover:bg-gray-700/50' : ''} transition-colors duration-150`}
                                    title={isClickable ? `Ver ubicación de ${event.poleIdExterno} en el mapa` : ''}
                                >
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.fechaRetiro.toLocaleString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.componente}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.poleIdExterno}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.streetlightIdExterno}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.municipio}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.zone}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.condicion}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.horasFuncionamiento.toLocaleString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.recuentoConmutacion.toLocaleString()}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs">{event.designacionTipo}</td>
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

export default ChangeEventTable;