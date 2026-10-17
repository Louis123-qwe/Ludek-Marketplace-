import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { FIREBASE_CONFIG } from './config.js';

const auth = getAuth(initializeApp(FIREBASE_CONFIG));

export const watchAuth = callback => onAuthStateChanged(auth, callback);

export const getToken = async (force = false) =>
  auth.currentUser ? auth.currentUser.getIdToken(force) : null;

export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);

export async function signUp({ email, password, fullName }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: fullName });
  return credential.user;
}

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());

export const resetPassword = email => sendPasswordResetEmail(auth, email);

export const logout = () => signOut(auth);
