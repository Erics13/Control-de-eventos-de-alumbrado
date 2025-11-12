import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// TODO: Reemplaza esto con la configuración de tu propio proyecto de Firebase
// Puedes obtenerla desde la consola de Firebase en:
// Configuración del proyecto > General > Tus apps > Configuración de SDK
const firebaseConfig = {
  apiKey: "AIzaSyD3hzL5g3vsy-dlpziNpuymb56KOktxGPo",
  authDomain: "gestion-de-fallas.firebaseapp.com",
  databaseURL: "https://gestion-de-fallas-default-rtdb.firebaseio.com",
  projectId: "gestion-de-fallas",
  storageBucket: "gestion-de-fallas.firebasestorage.app",
  messagingSenderId: "237732206931",
  appId: "1:237732206931:web:e131a9b1de9a453b77a9a6",
  measurementId: "G-G6629HRY62"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };