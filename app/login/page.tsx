"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

// Único método de acceso: Google Sign-In sobre Firebase Authentication.
// No hay usuarios de demostración, credenciales de prueba ni forma de entrar
// sin una sesión real: quien no se autentica no pasa de esta pantalla.

function mensajeError(codigo: string): string {
  const mapa: Record<string, string> = {
    "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
    "auth/account-exists-with-different-credential": "Ya existe una cuenta con ese correo usando otro método de acceso.",
    "auth/user-disabled": "Esta cuenta fue deshabilitada.",
    "auth/network-request-failed": "No pudimos conectar. Revisa tu conexión e intenta de nuevo.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a intentar.",
  };
  return mapa[codigo] || "No pudimos iniciar sesión. Intenta de nuevo.";
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.1 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C40.9 35.9 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión (o vuelve del flujo por redirección), entra directo.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function entrarConGoogle() {
    setError(null);
    setCargando(true);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (err: any) {
      setError(mensajeError(err?.code || ""));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-deep flex flex-col justify-center px-6 py-10 relative overflow-hidden">
      {/* halo sutil de marca */}
      <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-emerald/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />

      <div className="w-full max-w-sm mx-auto relative animate-rise">
        <div className="flex flex-col items-center mb-8">
          <img src="/icon.png" alt="Royal Sales AI" className="w-16 h-16 rounded-2xl shadow-cta mb-4" />
          <h1 className="text-2xl font-display font-bold text-white text-center tracking-tight">Royal Sales AI</h1>
          <p className="text-emerald-300/80 text-center text-sm mt-1.5 text-balance">
            Tu asistente inteligente para cada visita.
          </p>
        </div>

        <div className="bg-card rounded-3xl p-6 shadow-card">
          <h2 className="font-display font-bold text-brand-deep text-lg mb-2">Iniciar sesión</h2>
          <p className="text-[13px] text-muted mb-5">
            Usa la cuenta de Google con la que te dieron acceso a tu workspace.
          </p>

          <button
            type="button"
            onClick={entrarConGoogle}
            disabled={cargando}
            className="w-full min-h-[52px] rounded-2xl bg-white border border-hairline text-ink font-display font-semibold text-[15px] flex items-center justify-center gap-2.5 shadow-soft active:scale-[0.98] transition disabled:opacity-50"
          >
            {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            Continuar con Google
          </button>

          {error && <p className="text-sm text-danger font-medium mt-4">{error}</p>}
        </div>

        <p className="text-center text-emerald-400/70 text-xs mt-6 text-balance">
          Los vendedores son invitados por su distribuidor — no hay registro libre.
        </p>
      </div>
    </div>
  );
}
