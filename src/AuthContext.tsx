import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc, addDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type UserRole = 'user' | 'admin' | 'manager';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  photoURL?: string | null;
  createdAt: string;
  emailVerified: boolean;
  status: 'active' | 'suspended' | 'pending';
  invitedBy?: string;
  inviteCode?: string;
}

export interface InviteLink {
  id: string;
  code: string;
  createdBy: string;
  createdAt: string;
  used: boolean;
  usedBy?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<UserCredential>;
  logout: () => Promise<void>;
  generateAdminLink: () => Promise<string>;
  useInviteCode: (code: string) => Promise<void>;
  getAllUsers: () => Promise<UserProfile[]>;
  suspendUser: (uid: string) => Promise<void>;
  activateUser: (uid: string) => Promise<void>;
  deleteUserAccount: (uid: string) => Promise<void>;
  getAllInviteLinks: () => Promise<InviteLink[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid));
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || 'User',
            role: 'user',
            photoURL: u.photoURL || null,
            createdAt: new Date().toISOString(),
            emailVerified: true,
            status: 'pending',
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName: name,
      role: 'user',
      photoURL: cred.user.photoURL || null,
      createdAt: new Date().toISOString(),
      emailVerified: true,
      status: 'pending',
    };
    await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    setProfile(newProfile);
  };

  const signInWithEmail = async (email: string, password: string) => {
    return await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const generateAdminLink = async () => {
    if (!profile || profile.role !== 'manager') throw new Error('Only managers can generate admin links');
    const words = ['green', 'craft', 'admin', 'site', 'rwanda', 'web', 'nova', 'access'];
    const num = Math.floor(1000 + Math.random() * 900000);
    const word = words[Math.floor(Math.random() * words.length)];
    const code = `kelly-${num}${word}`;
    await addDoc(collection(db, 'inviteLinks'), {
      code,
      role: 'admin',
      type: 'admin-passkey',
      createdBy: profile.uid,
      createdAt: Timestamp.now(),
      used: false,
    });
    return code;
  };

  const useInviteCode = async (code: string) => {
    if (!user || !profile) throw new Error('Must be logged in');
    const q = query(collection(db, 'inviteLinks'), where('code', '==', code), where('used', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('Invalid or already used invite code');
    const inviteDoc = snap.docs[0];
    await updateDoc(inviteDoc.ref, { used: true, usedBy: user.uid });
    await updateDoc(doc(db, 'users', user.uid), { role: 'admin', invitedBy: inviteDoc.data().createdBy });
    setProfile(prev => prev ? { ...prev, role: 'admin' } : null);
  };

  const getAllUsers = async (): Promise<UserProfile[]> => {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => d.data() as UserProfile);
  };

  const suspendUser = async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { status: 'suspended' });
  };

  const activateUser = async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { status: 'active' });
  };

  const deleteUserAccount = async (uid: string) => {
    await deleteDoc(doc(db, 'users', uid));
  };

  const getAllInviteLinks = async (): Promise<InviteLink[]> => {
    const snap = await getDocs(collection(db, 'inviteLinks'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as InviteLink));
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUpWithEmail, signInWithEmail, logout,
      generateAdminLink, useInviteCode,
      getAllUsers, suspendUser, activateUser, deleteUserAccount,
      getAllInviteLinks,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
