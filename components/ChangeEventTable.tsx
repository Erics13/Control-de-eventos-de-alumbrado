
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

    const handleMapClick = (event: ChangeEvent) => {
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
                             <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                                Mapa
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {paginatedEvents.map((event) => {
                            const hasLocation = event.lat != null && event.lon != null;
                            return (
                                <tr 
                                    key={event.uniqueId}
                                    className="hover:bg-gray-700/50 transition-colors duration-150"
                                >
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.fechaRetiro?.toLocaleString() || 'N/A'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.componente}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.poleIdExterno}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.streetlightIdExterno}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.municipio}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.zone}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.condicion}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.horasFuncionamiento?.toLocaleString() ?? '0'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">{event.recuentoConmutacion?.toLocaleString() ?? '0'}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs">{event.designacionTipo}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                        {hasLocation ? (
                                            <button
                                                onClick={() => handleMapClick(event)}
                                                className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded-full transition-colors"
                                                title={`Ver ubicación de ${event.poleIdExterno} en el mapa`}
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

export default ChangeEventTable;
