"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { UserProfile } from "@/types/user";

// Diagnóstico del perfil: distingue "documento no existe" de "permiso denegado"
// de "error de red". Antes todos estos casos se trataban igual (perfil = null),
// lo que ocultaba la causa real del problema.
export type ProfileStatus = "loading" | "found" | "missing" | "error";

export type ProfileDiagnostics = {
  status: ProfileStatus;
  // Código de error de Firestore (ej. "permission-denied") si el listener falló.
  errorCode: string | null;
  // true si el dato vino solo de la caché offline y aún no se confirmó con el servidor.
  fromCache: boolean;
  // Proyecto de Firebase que está usando el NAVEGADOR. Debe coincidir con el
  // project_id del service account que usa el servidor (endpoint de seed).
  clientProjectId: string | null;
  // uid con el que el cliente busca el documento users/{uid}.
  uid: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  // loading combina: (1) Firebase todavía no determinó si hay sesión, y
  // (2) si hay sesión, todavía no llegó su documento de perfil desde Firestore.
  // Mientras loading sea true, nunca se debe mostrar el dashboard ni redirigir.
  loading: boolean;
  // Diagnóstico para saber POR QUÉ no hay perfil (no existe vs. permiso vs. red).
  profileDiagnostics: ProfileDiagnostics;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [profileErrorCode, setProfileErrorCode] = useState<string | null>(null);
  const [profileFromCache, setProfileFromCache] = useState(false);

  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setProfile(null);
        setProfileStatus("loading");
        setProfileErrorCode(null);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);
    setProfileStatus("loading");
    setProfileErrorCode(null);
    const ref = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setProfileFromCache(snap.metadata.fromCache);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          setProfileStatus("found");
        } else {
          // El documento no existe en ESTE proyecto para ESTE uid.
          // Nota: si el dato viene solo de caché (fromCache), puede que el
          // servidor todavía no haya respondido; el listener volverá a
          // dispararse con la copia del servidor y corregirá el estado.
          setProfile(null);
          setProfileStatus("missing");
        }
        setProfileLoading(false);
      },
      (err) => {
        // ANTES esto se silenciaba y se trataba como "perfil inexistente",
        // ocultando la causa real (p. ej. permission-denied). Ahora guardamos
        // el código de error para poder diagnosticarlo desde la propia app.
        console.error("[v0] onSnapshot users/{uid} error:", err.code, err.message);
        setProfile(null);
        setProfileStatus("error");
        setProfileErrorCode(err.code || "unknown");
        setProfileLoading(false);
      }
    );
    return unsubscribe;
  }, [user]);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  const loading = authLoading || (!!user && profileLoading);

  const profileDiagnostics: ProfileDiagnostics = {
    status: profileStatus,
    errorCode: profileErrorCode,
    fromCache: profileFromCache,
    clientProjectId,
    uid: user?.uid ?? null,
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, profileDiagnostics, signIn, signOut, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
