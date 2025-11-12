import React, { useState, useMemo } from 'react';
import { useUsers } from '../hooks/useUsers';
import type { UserProfile } from '../types';
import UserEditModal from './UserEditModal';

interface AdminTabProps {
    allZones: string[];
}

const AdminTab: React.FC<AdminTabProps> = ({ allZones }) => {
    const { users, loading, error } = useUsers();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

    const handleEditUser = (user: UserProfile) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
    };

    const filteredUsers = useMemo(() => {
        if (filter === 'all') return users;
        return users.filter(user => user.accessStatus === filter);
    }, [users, filter]);

    const getStatusChip = (status: UserProfile['accessStatus']) => {
        switch (status) {
            case 'approved':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-300">Aprobado</span>;
            case 'pending':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-900 text-yellow-300">Pendiente</span>;
            case 'rejected':
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-900 text-red-300">Rechazado</span>;
            default:
                return <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-300">Desconocido</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-800 shadow-lg rounded-xl p-4">
                <h2 className="text-xl font-bold text-cyan-400 mb-4">Gestión de Usuarios</h2>

                <div className="mb-4">
                    <div className="flex space-x-2">
                        <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-md text-sm ${filter === 'all' ? 'bg-cyan-600 text-white' : 'bg-gray-700'}`}>Todos</button>
                        <button onClick={() => setFilter('pending')} className={`px-3 py-1 rounded-md text-sm ${filter === 'pending' ? 'bg-cyan-600 text-white' : 'bg-gray-700'}`}>Pendientes</button>
                        <button onClick={() => setFilter('approved')} className={`px-3 py-1 rounded-md text-sm ${filter === 'approved' ? 'bg-cyan-600 text-white' : 'bg-gray-700'}`}>Aprobados</button>
                    </div>
                </div>

                {loading && <p>Cargando usuarios...</p>}
                {error && <p className="text-red-400">{error}</p>}

                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-700/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nombre</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Zona</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {filteredUsers.map(user => (
                                    <tr key={user.uid}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{user.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{user.email}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusChip(user.accessStatus)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 capitalize">{user.role || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{user.zone || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button 
                                                onClick={() => handleEditUser(user)}
                                                className="text-cyan-400 hover:text-cyan-300 font-medium"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {isModalOpen && selectedUser && (
                <UserEditModal 
                    user={selectedUser} 
                    onClose={handleCloseModal} 
                    allZones={allZones}
                />
            )}
        </div>
    );
};

export default AdminTab;
