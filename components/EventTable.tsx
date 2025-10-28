

import React, { useState, useMemo } from 'react';
import type { LuminaireEvent } from '../types';

const EventTable: React.FC<{ events: LuminaireEvent[] }> = ({ events }) => {
    const [sortConfig, setSortConfig] = useState<{ key: keyof LuminaireEvent; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const sortedEvents = useMemo(() => {
        let sortableItems = [...events];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
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
    }, [events, sortConfig]);

    const paginatedEvents = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedEvents.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedEvents, currentPage]);

    const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);

    const requestSort = (key: keyof LuminaireEvent) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: keyof LuminaireEvent) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };
    
    const columns: { key: keyof LuminaireEvent; label: string }[] = [
        { key: 'date', label: 'Date' },
        { key: 'id', label: 'ID' },
        { key: 'olcHardwareDir', label: 'Dirección Hardware OLC' },
        { key: 'municipio', label: 'Municipio' },
        { key: 'zone', label: 'Zone' },
        { key: 'power', label: 'Potencia (W)' },
        { key: 'systemMeasuredPower', label: 'Potencia Medida (W)' },
        { key: 'status', label: 'Status' },
        { key: 'failureCategory', label: 'Failure Category' },
        { key: 'description', label: 'Description' },
    ];

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-700/50">
                        <tr>
                            {columns.map(({key, label}) => (
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
                        {paginatedEvents.map((event) => (
                            <tr key={event.uniqueEventId} className="hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.date.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.olcHardwareDir || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.municipio}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.zone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.power || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-400 font-semibold">{event.systemMeasuredPower?.toFixed(2) ?? 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${event.status === 'FAILURE' ? 'bg-red-900 text-red-300' : 'bg-green-900 text-green-300'}`}>
                                        {event.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{event.failureCategory || 'N/A'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 truncate max-w-xs">{event.description}</td>
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

export default EventTable;