import React from 'react';
import type { ServicePoint } from '../types';

interface Props {
    servicePoints: ServicePoint[];
}

const FailedCabinetAccountsTable: React.FC<Props> = ({ servicePoints }) => {
    
    if (servicePoints.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 rounded-lg bg-gray-900/50 p-4">
                No se encontraron detalles para los servicios con falla. Verifique que los números de cuenta coincidan en las planillas.
            </div>
        );
    }
    
    return (
        <div className="overflow-auto border border-gray-700 rounded-lg" style={{maxHeight: '400px'}}>
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nro. Cuenta</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Dirección</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tarifa</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Pot. Cont. (kW)</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tensión</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fases</th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cant. Luminarias</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {servicePoints.map((sp) => (
                        <tr key={sp.nroCuenta} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.nroCuenta}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.direccion}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.tarifa}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.potenciaContratada.toLocaleString('es-ES')}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.tension}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.fases}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{sp.cantidadLuminarias.toLocaleString('es-ES')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default FailedCabinetAccountsTable;