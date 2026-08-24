"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FlaskConical } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileDiagnostics, signOut } = useAuth();
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
      <div className="min-h-screen bg-brand-deep flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!profile) {
    const esPermiso = profileDiagnostics.status === "error" && profileDiagnostics.errorCode === "permission-denied";
    const esError = profileDiagnostics.status === "error";

    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-6 py-10">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="font-bold text-green-950 mb-2">
            {esPermiso
              ? "Firestore rechazó la lectura de tu perfil"
              : esError
                ? "No se pudo leer tu perfil"
                : "Tu cuenta todavía no tiene un perfil asignado"}
          </p>
          <p className="text-sm text-gray-500 mb-4">
            {esPermiso
              ? "Iniciaste sesión, pero las reglas de seguridad negaron la lectura de tu documento de usuario."
              : esError
                ? "Iniciaste sesión, pero ocurrió un error al leer tu documento de usuario."
                : "Iniciaste sesión correctamente, pero no encontramos tu documento de usuario en la base de datos. La causa más común es que el navegador y el servidor apunten a proyectos de Firebase distintos: compara el proyecto de abajo con el projectId que reporta la pantalla de configuración inicial."}
          </p>

          {/* Diagnóstico en pantalla — pensado para revisar todo desde el móvil,
              sin necesidad de abrir la consola del navegador. */}
          <div className="text-left bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-1 break-all">
            <p>
              <span className="font-semibold text-green-950">Estado:</span> {profileDiagnostics.status}
            </p>
            {profileDiagnostics.errorCode && (
              <p>
                <span className="font-semibold text-green-950">Error:</span> {profileDiagnostics.errorCode}
              </p>
            )}
            <p>
              <span className="font-semibold text-green-950">Proyecto (navegador):</span>{" "}
              {profileDiagnostics.clientProjectId ?? "—"}
            </p>
            <p>
              <span className="font-semibold text-green-950">Tu uid:</span> {profileDiagnostics.uid ?? "—"}
            </p>
            {profileDiagnostics.fromCache && (
              <p className="text-orange-600">Dato servido desde caché offline (sin confirmar con el servidor).</p>
            )}
          </div>

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
    <div className="max-w-md mx-auto bg-surface min-h-screen">
      {profile.role === "reviewer" && (
        <div className="flex items-center justify-center gap-2 bg-accent-soft border-b border-accent/15 px-4 py-2">
          <FlaskConical className="w-3.5 h-3.5 text-accent shrink-0" />
          <p className="text-[11.5px] leading-tight text-center">
            <span className="font-semibold text-accent">Modo revisión</span>
            <span className="text-muted"> — los datos aquí no cuentan para tus estadísticas.</span>
          </p>
        </div>
      )}
      {children}
    </div>
  );
}
