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

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-white text-center mb-1">Royal Sales AI</h1>
        <p className="text-green-300 text-center text-sm mb-8">
          {modoRecuperar ? "Recupera tu acceso" : "Inicia sesión para continuar"}
        </p>

        <div className="bg-white rounded-2xl p-6">
          {!modoRecuperar ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Correo electrónico</label>
                <div className="flex items-center gap-2 border-2 border-gray-100 rounded-xl px-3.5 py-3 focus-within:border-green-800">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 outline-none text-gray-800"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Contraseña</label>
                <div className="flex items-center gap-2 border-2 border-gray-100 rounded-xl px-3.5 py-3 focus-within:border-green-800">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 outline-none text-gray-800"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3.5 rounded-xl bg-green-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => { setModoRecuperar(true); setError(null); }}
                className="w-full text-center text-sm text-green-800 font-medium pt-1"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form onSubmit={handleRecuperar} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Correo electrónico</label>
                <div className="flex items-center gap-2 border-2 border-gray-100 rounded-xl px-3.5 py-3 focus-within:border-green-800">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 outline-none text-gray-800"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {mensajeRecuperar && <p className="text-sm text-green-700">{mensajeRecuperar}</p>}
              <button
                type="submit"
                disabled={cargando}
                className="w-full py-3.5 rounded-xl bg-orange-500 text-green-950 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enviar correo de recuperación
              </button>
              <button
                type="button"
                onClick={() => { setModoRecuperar(false); setError(null); setMensajeRecuperar(null); }}
                className="w-full text-center text-sm text-gray-500 font-medium pt-1"
              >
                Volver a iniciar sesión
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-green-400 text-xs mt-6">
          Los vendedores son invitados por su distribuidor — no hay registro libre.
        </p>
      </div>
    </div>
  );
}
