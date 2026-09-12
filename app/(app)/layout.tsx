"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, FlaskConical, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, profileDiagnostics, isSuperAdmin, signOut, getIdToken } = useAuth();
  const router = useRouter();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapCargando, setBootstrapCargando] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // Al iniciar sesión con Google se registra el usuario en `users/{uid}` desde
  // el servidor (el cliente no puede escribir esa colección). El registro no
  // concede permisos: nace sin workspace hasta que un super admin lo asigne.
  useEffect(() => {
    if (!user) return;
    let cancelado = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token || cancelado) return;
        await fetch("/api/session", {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ displayName: user.displayName || "" }),
        });
      } catch {
        /* si falla, el usuario ve la pantalla de "cuenta sin workspace" */
      }
    })();
    return () => { cancelado = true; };
  }, [user, getIdToken]);

  // Bootstrap del super administrador. El servidor solo lo concede si el correo
  // del TOKEN coincide con SUPER_ADMIN_BOOTSTRAP_EMAIL; para cualquier otra
  // cuenta responde 403. Por eso el botón puede estar visible sin riesgo.
  async function activarSuperAdmin() {
    setBootstrapError(null);
    setBootstrapCargando(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setBootstrapError(data?.error || "No pudimos activar el acceso de administrador.");
        return;
      }
      router.replace("/admin");
    } catch {
      setBootstrapError("No pudimos conectar con el servidor.");
    } finally {
      setBootstrapCargando(false);
    }
  }

  // Mientras Firebase determina la sesión y (si hay sesión) llega el perfil
  // de Firestore, no mostramos nada más que el loader.
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  const sinWorkspace = !!profile && !profile.organizationId && !isSuperAdmin;

  if (!profile || sinWorkspace) {
    const esPermiso = profileDiagnostics.status === "error" && profileDiagnostics.errorCode === "permission-denied";
    const esError = profileDiagnostics.status === "error";

    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center px-6 py-10">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
          <p className="font-display font-bold text-brand-deep mb-2">
            {esError
              ? esPermiso
                ? "Firestore rechazó la lectura de tu perfil"
                : "No se pudo leer tu perfil"
              : "Tu cuenta todavía no tiene un workspace"}
          </p>
          <p className="text-sm text-muted mb-4">
            {esError
              ? "Iniciaste sesión, pero ocurrió un error al leer tu documento de usuario."
              : "Iniciaste sesión correctamente. Tu cuenta ya aparece en el panel de administración: pídele al administrador que te asigne a tu workspace."}
          </p>

          <div className="text-left bg-surface rounded-lg p-3 mb-4 text-xs text-muted space-y-1 break-all">
            <p><span className="font-semibold text-brand-deep">Correo:</span> {user.email ?? "—"}</p>
            <p><span className="font-semibold text-brand-deep">Proyecto:</span> {profileDiagnostics.clientProjectId ?? "—"}</p>
            <p><span className="font-semibold text-brand-deep">Tu uid:</span> {profileDiagnostics.uid ?? "—"}</p>
            {profileDiagnostics.errorCode && (
              <p><span className="font-semibold text-brand-deep">Error:</span> {profileDiagnostics.errorCode}</p>
            )}
          </div>

          <button
            onClick={activarSuperAdmin}
            disabled={bootstrapCargando}
            className="w-full min-h-[44px] rounded-xl bg-brand/[0.06] border border-brand/15 text-[13px] font-semibold text-brand-dark flex items-center justify-center gap-2 mb-3 disabled:opacity-50"
          >
            {bootstrapCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Soy el administrador de la plataforma
          </button>
          {bootstrapError && <p className="text-sm text-danger font-medium mb-3">{bootstrapError}</p>}

          <button onClick={signOut} className="text-sm font-semibold text-brand-dark min-h-[44px]">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (!profile.active) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <p className="font-display font-bold text-brand-deep mb-2">Esta cuenta está desactivada</p>
          <p className="text-sm text-muted mb-4">Contacta al administrador de la distribución.</p>
          <button onClick={signOut} className="text-sm font-semibold text-brand-dark">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-surface min-h-screen">
      {isSuperAdmin && (
        <button
          onClick={() => router.push("/admin")}
          className="w-full flex items-center justify-center gap-2 bg-brand-deep px-4 py-2 text-white"
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11.5px] font-semibold">Panel de administración</span>
        </button>
      )}
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
