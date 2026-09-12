"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
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
  /** ¿Está registrado en `systemAdmins`? Solo sirve para MOSTRAR el panel;
   *  la autorización real la hace el servidor en cada endpoint. */
  isSuperAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** ID token fresco para llamar a los endpoints /api/admin/*. */
  getIdToken: () => Promise<string | null>;
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        setProfile(null);
        setProfileStatus("loading");
        setProfileErrorCode(null);
        setIsSuperAdmin(false);
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

  // Marca de super administrador: se lee systemAdmins/{uid}, documento que el
  // usuario puede LEER (solo el suyo) pero nunca escribir. Si no existe o la
  // lectura falla, se asume que no lo es.
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "systemAdmins", user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => setIsSuperAdmin(snap.exists() && (snap.data() as any)?.active !== false),
      () => setIsSuperAdmin(false)
    );
    return unsubscribe;
  }, [user]);

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      // En algunos navegadores móviles la ventana emergente se bloquea; ahí
      // se continúa con redirección, que es el flujo compatible en iOS.
      const code = err?.code || "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment" ||
        code === "auth/cancelled-popup-request"
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function getIdToken() {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
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
      value={{ user, profile, loading, profileDiagnostics, isSuperAdmin, signInWithGoogle, signOut, getIdToken }}
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
