import React, { useState, useEffect } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../firebase';
import type { UserProfile } from '../types';

interface UserEditModalProps {
    user: UserProfile;
    onClose: () => void;
    allZones: string[];
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, allZones }) => {
    const [accessStatus, setAccessStatus] = useState<UserProfile['accessStatus']>(user.accessStatus);
    const [role, setRole] = useState(user.role || '');
    const [zone, setZone] = useState<string | string[]>(user.zone || (user.role === 'regional' ? [] : ''));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // When role changes, reset zone state to avoid invalid data combinations
        if (role === 'administrador' || !role) {
            setZone('');
        } else if (role === 'regional') {
            // If switching to regional, ensure zone is an array
            if (typeof zone === 'string') {
                setZone(zone ? [zone] : []);
            }
        } else if (role === 'capataz' || role === 'cuadrilla') {
            // If switching to a single-zone role, ensure zone is a string
            if (Array.isArray(zone)) {
                setZone(zone[0] || ''); // Take the first zone or reset
            }
        }
    }, [role]);

    const handleSave = async () => {
        setError('');
        setLoading(true);

        const userRef = ref(db, 'users/' + user.uid);
        
        let finalZone: string | string[] | null = null;
        if ((role === 'capataz' || role === 'cuadrilla') && typeof zone === 'string' && zone) {
            finalZone = zone;
        } else if (role === 'regional' && Array.isArray(zone) && zone.length > 0) {
            finalZone = zone;
        }

        const dataToUpdate = {
            accessStatus,
            role: (role as UserProfile['role']) || null,
            zone: finalZone,
        };

        try {
            await update(userRef, dataToUpdate);
            onClose();
        } catch (err) {
            console.error("Error updating user:", err);
            setError("No se pudo guardar los cambios. Inténtelo de nuevo.");
        } finally {
            setLoading(false);
        }
    };
    
    const handleZoneCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const zoneName = e.target.value;
        const isChecked = e.target.checked;
        setZone(prev => {
            const currentZones = Array.isArray(prev) ? prev : [];
            if (isChecked) {
                return [...currentZones, zoneName];
            } else {
                return currentZones.filter(z => z !== zoneName);
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-cyan-400">Editar Usuario</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                
                <div className="mb-4">
                    <p><strong>Nombre:</strong> {user.name}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Estado de Acceso</label>
                        <select
                            value={accessStatus}
                            onChange={(e) => setAccessStatus(e.target.value as UserProfile['accessStatus'])}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        >
                            <option value="pending">Pendiente</option>
                            <option value="approved">Aprobado</option>
                            <option value="rejected">Rechazado</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Rol</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        >
                            <option value="">-- Sin Rol --</option>
                            <option value="administrador">Administrador</option>
                            <option value="regional">Regional</option>
                            <option value="capataz">Capataz</option>
                            <option value="cuadrilla">Cuadrilla</option>
                        </select>
                    </div>

                    {(role === 'capataz' || role === 'cuadrilla') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Zona Asignada</label>
                            <select
                                value={typeof zone === 'string' ? zone : ''}
                                onChange={(e) => setZone(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                            >
                                <option value="">-- Seleccione una Zona --</option>
                                {allZones.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </div>
                    )}

                    {role === 'regional' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Zonas Asignadas</label>
                            <div className="max-h-40 overflow-y-auto bg-gray-700 border border-gray-600 rounded-md p-2 space-y-2">
                                {allZones.map(z => (
                                    <div key={z} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={`zone-${z}`}
                                            value={z}
                                            checked={Array.isArray(zone) && zone.includes(z)}
                                            onChange={handleZoneCheckboxChange}
                                            className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-cyan-600 focus:ring-cyan-500"
                                        />
                                        <label htmlFor={`zone-${z}`} className="ml-2 text-sm text-gray-200">{z}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

                <div className="mt-6 flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-500"
                    >
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UserEditModal;