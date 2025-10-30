import React from 'react';

interface Props {
    accounts: string[];
}

const FailedCabinetAccountsTable: React.FC<Props> = ({ accounts }) => {
    return (
        <div className="overflow-x-auto border border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nro. de Cuenta del Servicio con Falla</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {accounts.map((account) => (
                        <tr key={account}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{account}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default FailedCabinetAccountsTable;
