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
  const [diagnostico, setDiagnostico] = useState<any>(null);

  // Estado independiente para el seed de garantías (colección warrantyKnowledge).
  const [cargandoGar, setCargandoGar] = useState(false);
  const [garMsg, setGarMsg] = useState<string | null>(null);
  const [garError, setGarError] = useState<string | null>(null);

  async function sembrarGarantias() {
    if (cargandoGar) return;
    setCargandoGar(true);
    setGarMsg(null);
    setGarError(null);
    try {
      const response = await fetch("/api/admin/seed-warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secreto.trim() }),
      });
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        setGarError("El servidor respondió de forma inesperada. Revisa los logs en Vercel.");
        return;
      }
      if (!response.ok || !data?.ok) {
        setGarError(data?.error || "No pudimos sembrar las garantías.");
        return;
      }
      setGarMsg(`Listo: ${data.sembrados} garantías oficiales en Firestore. Puedes repetirlo sin duplicar.`);
    } catch {
      setGarError("No pudimos conectar con el servidor. Revisa tu conexión.");
    } finally {
      setCargandoGar(false);
    }
  }

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

      setDiagnostico(data?.diagnostico ?? null);
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
            <p className="text-xs text-gray-500 mb-4">Ya puedes iniciar sesión con cualquiera de las dos cuentas.</p>

            {/* Diagnóstico: confirma que el navegador y el servidor usan el MISMO
                proyecto de Firebase. Si no coinciden, el login nunca encontrará
                el perfil recién creado por más que el setup diga "OK". */}
            {diagnostico && (
              <div
                className={`text-left rounded-xl p-3 mb-4 text-xs space-y-1 break-all border ${
                  diagnostico.proyectosCoinciden
                    ? "bg-green-50 border-green-100 text-green-900"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                <p>
                  <span className="font-semibold">Proyecto navegador:</span>{" "}
                  {diagnostico.proyectoNavegador ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Proyecto servidor:</span>{" "}
                  {diagnostico.proyectoServidor ?? "—"}
                </p>
                <p className="font-semibold">
                  {diagnostico.proyectosCoinciden
                    ? "Los proyectos coinciden. Ya puedes entrar."
                    : "Los proyectos NO coinciden — esta es la causa del problema."}
                </p>
                {diagnostico.PROBLEMA && <p>{diagnostico.PROBLEMA}</p>}
              </div>
            )}

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

            {/* Seed independiente del conocimiento oficial de garantías. Usa el
                mismo secreto. Es idempotente: puede reejecutarse sin duplicar. */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Garantías oficiales (Royal Copilot)
              </p>
              <button
                onClick={sembrarGarantias}
                disabled={!secreto.trim() || cargandoGar}
                className="w-full py-3 rounded-xl bg-green-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {cargandoGar ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sembrando garantías…
                  </>
                ) : (
                  "Sembrar 30 garantías oficiales"
                )}
              </button>
              {garMsg && (
                <div className="mt-3 flex gap-2 text-sm text-green-800 bg-green-50 border border-green-100 rounded-xl p-3">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{garMsg}</span>
                </div>
              )}
              {garError && (
                <div className="mt-3 flex gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{garError}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
