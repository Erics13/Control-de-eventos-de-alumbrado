import { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild } from 'firebase/database';
import { db } from '../firebase';
import type { UserProfile } from '../types';

export const useUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const usersRef = ref(db, 'users');
        const q = query(usersRef, orderByChild('createdAt'));

        const unsubscribe = onValue(q, 
            (snapshot) => {
                if (snapshot.exists()) {
                    const usersObject = snapshot.val();
                    const usersData: UserProfile[] = Object.values(usersObject);
                    // Sort descending in the client since RTDB orderByChild is ascending
                    usersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                    setUsers(usersData);
                } else {
                    setUsers([]);
                }
                setLoading(false);
            }, 
            (err) => {
                console.error("Error fetching users:", err);
                setError("No se pudo cargar la lista de usuarios.");
                setLoading(false);
            }
        );

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    return { users, loading, error };
};