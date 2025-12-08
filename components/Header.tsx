
import React from 'react';
import { format } from 'date-fns/format';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import type { UserProfile } from '../types';

interface HeaderProps {
    latestDataDate: Date | null;
    userProfile: UserProfile | null;
}

const Header: React.FC<HeaderProps> = ({ latestDataDate, userProfile }) => {
    
    const handleLogout = () => {
        signOut(auth).catch(error => console.error('Logout Error:', error));
    };

    return (
        <header className="bg-gray-800/50 backdrop-blur-sm shadow-lg flex-shrink-0 z-20">
            <div className="container mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-wider">
                            Gestión Alumbrado Público Canelones
                        </h1>
                        {latestDataDate && (
                            <h2 className="text-sm text-cyan-300">
                                Datos al {format(latestDataDate, 'dd/MM/yyyy')}
                            </h2>
                        )}
                    </div>
                </div>
                {userProfile && (
                     <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-300 hidden sm:block">
                            Bienvenido, <span className="font-semibold">{userProfile.name}</span>
                        </span>
                        <button 
                            onClick={handleLogout}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;