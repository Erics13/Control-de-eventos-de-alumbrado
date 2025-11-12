import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { auth, db } from '../firebase';
import type { UserProfile } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                // Fetch user profile from Realtime Database
                const userRef = ref(db, 'users/' + currentUser.uid);
                const snapshot = await get(userRef);
                if (snapshot.exists()) {
                    setUserProfile(snapshot.val() as UserProfile);
                } else {
                    // Auto-repair: If a user is authenticated but has no profile, create one.
                    console.warn("No user profile found for UID:", currentUser.uid, "Creating a new pending profile.");
                    const newProfile: UserProfile = {
                        uid: currentUser.uid,
                        email: currentUser.email!, // Assume email exists for auth'd users
                        name: currentUser.displayName || 'Usuario sin Perfil',
                        createdAt: new Date().toISOString(),
                        accessStatus: 'pending',
                        role: null,
                        zone: null,
                    };
                    try {
                        await set(userRef, newProfile);
                        setUserProfile(newProfile);
                    } catch (dbError) {
                        console.error("Failed to auto-create user profile in database:", dbError);
                        setUserProfile(null);
                    }
                }
            } else {
                setUser(null);
                setUserProfile(null);
            }
            setLoading(false);
        });

        // Cleanup subscription on unmount
        return () => unsubscribe();
    }, []);

    return { user, userProfile, loading };
};