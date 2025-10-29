
import React, { useState, useMemo } from 'react';

interface FailureData {
    name: string;
    count: number;
}

interface UniqueFailuresByZoneTableProps {
    data: FailureData[];
}

type SortKey = keyof FailureData;

const UniqueFailuresByZoneTable: React.FC<UniqueFailuresByZoneTableProps> = ({ data }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'ascending' | 'descending' } | null>({ key: 'count', direction: 'descending' });

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

    const requestSort = (key: SortKey) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };

    if (data.length === 0) {
        return <div className="flex items-center justify-center h-40 text-gray-500 rounded-lg bg-gray-800/50">No hay datos de fallas para mostrar.</div>;
    }

    return (
        <div className="border border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            <button onClick={() => requestSort('name')} className="flex items-center gap-2">
                                Zona
                                <span className="text-cyan-400">{getSortIndicator('name')}</span>
                            </button>
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            <button onClick={() => requestSort('count')} className="flex items-center gap-2">
                                Puntos Únicos con Falla
                                <span className="text-cyan-400">{getSortIndicator('count')}</span>
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {sortedItems.map((item) => (
                        <tr key={item.name} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-300">{item.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{item.count.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UniqueFailuresByZoneTable;