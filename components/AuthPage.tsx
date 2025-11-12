import React, { useState } from 'react';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebase';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
                // Login successful, onAuthStateChanged will handle the redirect
            } else {
                if(name.trim() === '') {
                    setError('Por favor, ingrese su nombre.');
                    setLoading(false);
                    return;
                }
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Update Firebase Auth profile
                await updateProfile(user, { displayName: name });

                // Create user profile in Realtime Database for role assignment
                const userRef = ref(db, 'users/' + user.uid);
                await set(userRef, {
                    uid: user.uid,
                    email: user.email,
                    name: name,
                    createdAt: new Date().toISOString(),
                    accessStatus: 'pending', // Admin must approve and assign role
                    role: null,
                    zone: null,
                });
                // Sign up successful, onAuthStateChanged will take over.
            }
        } catch (err: any) {
            console.error(err);
            if (err.code) {
                switch(err.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                         setError('Correo electrónico o contraseña incorrectos.');
                         break;
                    case 'auth/email-already-in-use':
                        setError('Este correo electrónico ya está registrado.');
                        break;
                    case 'auth/weak-password':
                        setError('La contraseña debe tener al menos 6 caracteres.');
                        break;
                    default:
                        setError('Ocurrió un error. Por favor, inténtelo de nuevo.');
                }
            } else {
                 setError('Ocurrió un error inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-2xl shadow-xl">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-bold text-white">
                        {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        {isLogin ? 'Bienvenido de nuevo' : 'Regístrese para acceder al sistema'}
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div>
                            <label htmlFor="name" className="sr-only">Nombre</label>
                            <input
                                id="name" name="name" type="text" autoComplete="name" required
                                value={name} onChange={e => setName(e.target.value)}
                                className="appearance-none rounded-t-md relative block w-full px-3 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                                placeholder="Nombre Completo"
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email-address" className="sr-only">Correo electrónico</label>
                        <input
                            id="email-address" name="email" type="email" autoComplete="email" required
                            value={email} onChange={e => setEmail(e.target.value)}
                            className={`appearance-none relative block w-full px-3 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm ${isLogin ? 'rounded-md' : 'rounded-none'}`}
                            placeholder="Correo electrónico"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Contraseña</label>
                        <input
                            id="password" name="password" type="password" autoComplete="current-password" required
                            value={password} onChange={e => setPassword(e.target.value)}
                            className={`appearance-none relative block w-full px-3 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm ${isLogin ? 'rounded-md' : 'rounded-b-md'}`}
                            placeholder="Contraseña"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-center">
                            <p className="text-sm text-red-300">{error}</p>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-cyan-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
                        </button>
                    </div>
                </form>
                <div className="text-sm text-center">
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-medium text-cyan-400 hover:text-cyan-300">
                        {isLogin ? '¿No tiene una cuenta? Regístrese' : '¿Ya tiene una cuenta? Inicie sesión'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;