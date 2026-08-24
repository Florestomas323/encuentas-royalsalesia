"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

// Pantalla de configuración inicial. Se ejecuta una sola vez para crear los
// perfiles de Firestore de los usuarios que ya existen en Firebase Authentication.
// La protección es el secreto de servidor, no la sesión.
export default function AdminSeedPage() {
  const [secreto, setSecreto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar() {
    if (cargando) return; // evita doble envío
    setCargando(true);
    setError(null);
    setListo(false);

    try {
      const response = await fetch("/api/admin/seed-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secreto.trim() }),
      });

      // Si el servidor devolviera HTML (por ejemplo una página de error), este
      // parse fallaría — lo capturamos para dar un mensaje entendible.
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        setError("El servidor respondió de forma inesperada. Revisa los logs en Vercel.");
        return;
      }

      if (!response.ok || !data?.ok) {
        setError(data?.error || "No pudimos completar la configuración inicial.");
        return;
      }

      setListo(true);
    } catch {
      setError("No pudimos conectar con el servidor. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6">
        <h1 className="font-bold text-green-950 mb-1">Configuración inicial</h1>
        <p className="text-xs text-gray-500 mb-4">
          Crea los perfiles del distribuidor y de la cuenta de revisión. Solo necesitas hacerlo una vez.
        </p>

        {listo ? (
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="font-semibold text-green-950 mb-1">Configuración inicial completada correctamente.</p>
            <p className="text-xs text-gray-500 mb-5">Ya puedes iniciar sesión con cualquiera de las dos cuentas.</p>
            <a
              href="/login"
              className="block w-full py-3 rounded-xl bg-green-800 text-white font-semibold"
            >
              Ir al inicio de sesión
            </a>
          </div>
        ) : (
          <>
            <label htmlFor="secreto" className="text-xs font-semibold text-gray-500 mb-1 block">
              Secreto (SEED_ADMIN_SECRET)
            </label>
            <input
              id="secreto"
              type="password"
              value={secreto}
              onChange={(e) => setSecreto(e.target.value)}
              disabled={cargando}
              className="w-full border-2 border-gray-100 rounded-xl p-3 mb-3 text-base focus:border-green-800 focus:outline-none disabled:bg-gray-50"
              placeholder="Pégalo aquí"
            />
            <button
              onClick={ejecutar}
              disabled={!secreto.trim() || cargando}
              className="w-full py-3 rounded-xl bg-green-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {cargando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creando perfiles…
                </>
              ) : (
                "Crear perfiles"
              )}
            </button>

            {error && (
              <div className="mt-4 flex gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
