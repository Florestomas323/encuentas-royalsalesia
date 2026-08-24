"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

function mensajeError(codigo: string): string {
  const mapa: Record<string, string> = {
    "auth/invalid-email": "El correo no es válido.",
    "auth/user-disabled": "Esta cuenta fue deshabilitada.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a intentar.",
  };
  return mapa[codigo] || "No pudimos iniciar sesión. Intenta de nuevo.";
}

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modoRecuperar, setModoRecuperar] = useState(false);
  const [mensajeRecuperar, setMensajeRecuperar] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await signIn(email, password);
      router.push("/");
    } catch (err: any) {
      setError(mensajeError(err.code));
    } finally {
      setCargando(false);
    }
  }

  async function handleRecuperar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMensajeRecuperar(null);
    setCargando(true);
    try {
      await resetPassword(email);
      setMensajeRecuperar("Te enviamos un correo con instrucciones para restablecer tu contraseña.");
    } catch (err: any) {
      setError(mensajeError(err.code));
    } finally {
      setCargando(false);
    }
  }

  const inputWrap =
    "flex items-center gap-2.5 bg-white border border-hairline rounded-2xl px-4 h-[52px] shadow-soft focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 transition";
  const inputBase = "flex-1 outline-none text-base text-ink placeholder:text-muted/45 bg-transparent";
  const labelBase = "text-[13px] font-medium text-muted mb-1.5 block";

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
          <h2 className="font-display font-bold text-brand-deep text-lg mb-5">
            {modoRecuperar ? "Recupera tu acceso" : "Iniciar sesión"}
          </h2>
          {!modoRecuperar ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelBase}>Correo electrónico</label>
                <div className={inputWrap}>
                  <Mail className="w-[18px] h-[18px] text-muted/60" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="tu@correo.com" />
                </div>
              </div>
              <div>
                <label className={labelBase}>Contraseña</label>
                <div className={inputWrap}>
                  <Lock className="w-[18px] h-[18px] text-muted/60" />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputBase} placeholder="••••••••" />
                </div>
              </div>
              {error && <p className="text-sm text-danger font-medium">{error}</p>}
              <button
                type="submit"
                disabled={cargando}
                className="w-full min-h-[52px] rounded-2xl bg-brand-dark text-white font-display font-semibold text-[15px] flex items-center justify-center gap-2 shadow-card active:scale-[0.98] transition disabled:opacity-50"
              >
                {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => { setModoRecuperar(true); setError(null); }}
                className="w-full text-center text-sm text-brand-dark font-medium pt-1 min-h-[44px]"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form onSubmit={handleRecuperar} className="space-y-4">
              <div>
                <label className={labelBase}>Correo electrónico</label>
                <div className={inputWrap}>
                  <Mail className="w-[18px] h-[18px] text-muted/60" />
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputBase} placeholder="tu@correo.com" />
                </div>
              </div>
              {error && <p className="text-sm text-danger font-medium">{error}</p>}
              {mensajeRecuperar && <p className="text-sm text-brand font-medium">{mensajeRecuperar}</p>}
              <button
                type="submit"
                disabled={cargando}
                className="w-full min-h-[52px] rounded-2xl bg-accent text-white font-display font-semibold text-[15px] flex items-center justify-center gap-2 shadow-cta active:scale-[0.98] transition disabled:opacity-50"
              >
                {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enviar correo de recuperación
              </button>
              <button
                type="button"
                onClick={() => { setModoRecuperar(false); setError(null); setMensajeRecuperar(null); }}
                className="w-full text-center text-sm text-muted font-medium pt-1 min-h-[44px]"
              >
                Volver a iniciar sesión
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-emerald-400/70 text-xs mt-6 text-balance">
          Los vendedores son invitados por su distribuidor — no hay registro libre.
        </p>
      </div>
    </div>
  );
}
