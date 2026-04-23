import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your config object
const firebaseConfig = {
  apiKey: "AIzaSyDHVyYBupJ7G7-bneYuwXsibqfFA5IzLvA",
  authDomain: "tulong-app-c7aaa.firebaseapp.com",
  projectId: "tulong-app-c7aaa",
  storageBucket: "tulong-app-c7aaa.firebasestorage.app",
  messagingSenderId: "499151598398",
  appId: "1:499151598398:web:49919f7287e5105272726f"
};

// Initialize App
const app = initializeApp(firebaseConfig);

// 3. FIX: Initialize Auth with React Native persistence instead of getAuth()
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage as any)
});

const db = getFirestore(app);

export { auth, db };

