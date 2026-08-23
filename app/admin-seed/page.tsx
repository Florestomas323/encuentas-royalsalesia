"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Pantalla de un solo uso: crea los documentos de Firestore para Andrés
// (distributor) y para florestomas323@gmail.com (reviewer). No requiere haber
// iniciado sesión en la app — la protección es el secreto, no Firebase Auth.
// Después de usarla una vez, puedes borrar SEED_ADMIN_SECRET de Vercel para
// desactivarla por completo.
export default function AdminSeedPage() {
  const [secreto, setSecreto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar() {
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/admin/seed-users", {
        method: "POST",
        headers: { "x-seed-secret": secreto },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ocurrió un error.");
      } else {
        setResultado(data);
      }
    } catch (e: any) {
      setError(e.message || "Error de red.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white rounded-2xl p-6">
        <h1 className="font-bold text-green-950 mb-1">Configuración inicial</h1>
        <p className="text-xs text-gray-500 mb-4">
          Crea los perfiles de Andrés Characo (distribuidor) y de la cuenta de revisión. Solo necesitas hacerlo una vez.
        </p>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Secreto (SEED_ADMIN_SECRET)</label>
        <input
          type="password"
          value={secreto}
          onChange={(e) => setSecreto(e.target.value)}
          className="w-full border-2 border-gray-100 rounded-xl p-3 mb-3 focus:border-green-800 focus:outline-none"
          placeholder="Pégalo aquí"
        />
        <button
          onClick={ejecutar}
          disabled={!secreto || cargando}
          className="w-full py-3 rounded-xl bg-green-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Crear perfiles
        </button>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
        {resultado && (
          <div className="mt-4 text-sm text-green-800 bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="font-semibold mb-1">Listo.</p>
            <p>Distribuidor: {resultado.distributor?.uid}</p>
            <p>Reviewer: {resultado.reviewer?.uid}</p>
          </div>
        )}
      </div>
    </div>
  );
}
