"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Mientras Firebase determina la sesión y (si hay sesión) llega el perfil
  // de Firestore, no mostramos nada más que el loader — así evitamos que el
  // dashboard aparezca un instante antes de saber quién es el usuario.
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <p className="font-bold text-green-950 mb-2">Tu cuenta todavía no tiene un perfil asignado</p>
          <p className="text-sm text-gray-500 mb-4">
            Iniciaste sesión correctamente, pero no encontramos tu documento de usuario en la base de datos.
            Contacta al administrador de la distribución.
          </p>
          <button
            onClick={signOut}
            className="text-sm font-semibold text-green-800"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!profile.active) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <p className="font-bold text-green-950 mb-2">Esta cuenta está desactivada</p>
          <p className="text-sm text-gray-500 mb-4">Contacta al administrador de la distribución.</p>
          <button onClick={signOut} className="text-sm font-semibold text-green-800">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      {profile.role === "reviewer" && (
        <div className="bg-orange-500 text-green-950 text-xs font-semibold px-4 py-1.5 flex items-center gap-1.5 justify-center">
          <FlaskConical className="w-3.5 h-3.5" /> Modo revisión — estos datos no cuentan para estadísticas
        </div>
      )}
      <div className="flex justify-end px-4 py-1.5 bg-gray-50">
        <button onClick={signOut} className="flex items-center gap-1 text-xs font-medium text-gray-500">
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </button>
      </div>
      {children}
    </div>
  );
}
