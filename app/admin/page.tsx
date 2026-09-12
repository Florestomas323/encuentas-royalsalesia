"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShieldCheck, Users, Building2, ArrowLeft, Check, X, BookOpen, LogIn, DoorOpen, MailPlus } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { AdminUserRow, Workspace, WorkspaceInvitation } from "@/types/user";
import { ASSIGNABLE_ROLES } from "@/types/user";

// Panel del SUPER ADMINISTRADOR.
// La marca `isSuperAdmin` solo decide qué se PINTA. La autorización real está
// en cada endpoint /api/admin/*, que verifica el ID token contra la colección
// `systemAdmins` en el servidor: abrir esta URL sin ser super admin no sirve
// de nada, porque todas las llamadas responden 403.

// Roles reales del proyecto, desde la fuente única en types/user.ts.
const ROLES = ASSIGNABLE_ROLES;

export default function AdminPage() {
  const { user, profile, loading, isSuperAdmin, getIdToken, signOut } = useAuth();
  const router = useRouter();

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUserRow[]>([]);
  const [invitaciones, setInvitaciones] = useState<WorkspaceInvitation[]>([]);
  const [invEmail, setInvEmail] = useState("");
  const [invOrg, setInvOrg] = useState("");
  const [invRole, setInvRole] = useState<string>("salesperson");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Selección por usuario para el formulario de asignación.
  const [seleccion, setSeleccion] = useState<Record<string, { orgId: string; role: string }>>({});

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  const llamar = useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getIdToken();
      const res = await fetch(url, {
        ...init,
        headers: { ...(init?.headers || {}), authorization: `Bearer ${token}`, "content-type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "La operación no se pudo completar.");
      return data;
    },
    [getIdToken]
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [w, u, i] = await Promise.all([
        llamar("/api/admin/workspaces"),
        llamar("/api/admin/users"),
        llamar("/api/admin/invitations"),
      ]);
      setWorkspaces(w.workspaces || []);
      setUsuarios(u.users || []);
      setInvitaciones(i.invitations || []);
    } catch (e: any) {
      setError(e?.message || "No pudimos cargar el panel.");
    } finally {
      setCargando(false);
    }
  }, [llamar]);

  useEffect(() => {
    if (!loading && user) cargar();
  }, [loading, user, cargar]);

  async function crearWorkspace() {
    const name = nombreNuevo.trim();
    if (!name || ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/workspaces", { method: "POST", body: JSON.stringify({ name }) });
      setNombreNuevo("");
      setAviso(`Workspace "${name}" creado.`);
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarEstadoWorkspace(w: Workspace) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/workspaces", { method: "PATCH", body: JSON.stringify({ id: w.id, active: !w.active }) });
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  async function asignar(uid: string) {
    const sel = seleccion[uid];
    if (!sel?.orgId || !sel?.role || ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/memberships", {
        method: "POST",
        body: JSON.stringify({ uid, organizationId: sel.orgId, role: sel.role }),
      });
      setAviso("Acceso asignado.");
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  async function quitar(uid: string, organizationId: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/memberships", { method: "DELETE", body: JSON.stringify({ uid, organizationId }) });
      setAviso("Acceso retirado.");
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  // "Entrar al workspace": el servidor cambia SOLO el workspace activo del
  // super admin (users/{uid}.organizationId). El rol no se toca y no se copia
  // ningún dato; la app simplemente pasa a consultar esa organización.
  async function entrarAlWorkspace(w: Workspace) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/active-workspace", {
        method: "POST",
        body: JSON.stringify({ organizationId: w.id }),
      });
      router.push("/");
    } catch (e: any) {
      setAviso(e?.message);
      setOcupado(false);
    }
  }

  async function salirDelWorkspace() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/active-workspace", {
        method: "POST",
        body: JSON.stringify({ organizationId: null }),
      });
      setAviso("Saliste del workspace.");
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  // Invitar por correo a alguien que todavía no ha iniciado sesión. El correo,
  // el workspace y el rol quedan guardados en el servidor; la persona solo tiene
  // que entrar con Google y el sistema le asigna su acceso.
  async function crearInvitacion() {
    const email = invEmail.trim().toLowerCase();
    if (!email || !invOrg || ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/invitations", {
        method: "POST",
        body: JSON.stringify({ email, organizationId: invOrg, role: invRole }),
      });
      setInvEmail("");
      setAviso(`Invitación creada para ${email}.`);
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  async function cancelarInvitacion(id: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      await llamar("/api/admin/invitations", { method: "DELETE", body: JSON.stringify({ id }) });
      setAviso("Invitación cancelada.");
      await cargar();
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  async function sembrarFichas() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await llamar("/api/admin/seed-product-knowledge", { method: "POST" });
      setAviso(`Listo: ${r.sembradas} ficha(s) de producto cargadas.`);
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  async function sembrarGarantias() {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await llamar("/api/admin/seed-warranty", { method: "POST" });
      setAviso(`Listo: ${r.sembrados} garantías oficiales cargadas.`);
    } catch (e: any) {
      setAviso(e?.message);
    } finally {
      setOcupado(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center">
          <p className="font-display font-bold text-brand-deep mb-2">Acceso restringido</p>
          <p className="text-sm text-muted mb-4">Esta sección es solo para el administrador de la plataforma.</p>
          <button onClick={() => router.replace("/")} className="text-sm font-semibold text-brand-dark min-h-[44px]">
            Volver a la aplicación
          </button>
        </div>
      </div>
    );
  }

  const input =
    "w-full bg-card border border-hairline rounded-xl px-3 h-11 text-[14px] text-ink placeholder:text-muted/45 focus:border-brand focus:outline-none";

  return (
    <div className="max-w-md mx-auto bg-surface min-h-screen pb-16">
      <div className="bg-brand-deep px-5 py-4 flex items-center gap-3">
        <button onClick={() => router.push("/")} aria-label="Volver" className="text-white/80">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <p className="font-display font-bold text-white text-[17px] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Administración
          </p>
          <p className="text-emerald-300/70 text-[12px]">{user.email}</p>
        </div>
        <button onClick={signOut} className="text-[12px] font-semibold text-emerald-300/90">Salir</button>
      </div>

      {aviso && (
        <div className="mx-5 mt-4 rounded-xl bg-brand/[0.06] border border-brand/15 px-3 py-2 text-[13px] text-brand-dark">
          {aviso}
        </div>
      )}
      {error && (
        <div className="mx-5 mt-4 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-[13px] text-danger">{error}</div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
      ) : (
        <div className="px-5 py-5 space-y-7">
          {/* ---------- WORKSPACES ---------- */}
          <section>
            <h2 className="font-display font-bold text-brand-deep text-[16px] flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4" /> Workspaces ({workspaces.length})
            </h2>

            {profile?.organizationId && (
              <p className="text-[12.5px] text-brand-dark bg-brand/[0.06] border border-brand/15 rounded-xl px-3 py-2 mb-3">
                Estás dentro de{" "}
                <span className="font-semibold">
                  {workspaces.find((w) => w.id === profile.organizationId)?.name || profile.organizationId}
                </span>
                . La aplicación muestra los datos de ese workspace.
              </p>
            )}

            <div className="flex gap-2 mb-3">
              <input
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Nombre del nuevo workspace"
                className={input}
              />
              <button
                onClick={crearWorkspace}
                disabled={ocupado || !nombreNuevo.trim()}
                className="h-11 px-4 rounded-xl bg-brand-dark text-white text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" /> Crear
              </button>
            </div>

            <div className="space-y-2">
              {workspaces.length === 0 && <p className="text-[13px] text-muted">Todavía no hay workspaces.</p>}
              {workspaces.map((w) => {
                const esActual = profile?.organizationId === w.id;
                return (
                  <div key={w.id} className="bg-card border border-hairline rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-[14px] text-brand-deep truncate">{w.name}</p>
                        <p className="text-[11px] text-muted break-all">{w.id}</p>
                      </div>
                      <button
                        onClick={() => cambiarEstadoWorkspace(w)}
                        disabled={ocupado}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                          w.active
                            ? "bg-brand/[0.06] border-brand/15 text-brand-dark"
                            : "bg-red-50 border-red-100 text-danger"
                        }`}
                      >
                        {w.active ? "Activo" : "Inactivo"}
                      </button>
                    </div>

                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => entrarAlWorkspace(w)}
                        disabled={ocupado}
                        className="flex-1 min-h-[40px] rounded-xl bg-brand-dark text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
                      >
                        <LogIn className="w-4 h-4" />
                        {esActual ? "Volver a entrar" : "Entrar al workspace"}
                      </button>
                      {esActual && (
                        <button
                          onClick={salirDelWorkspace}
                          disabled={ocupado}
                          className="min-h-[40px] px-3 rounded-xl bg-brand/[0.06] border border-brand/15 text-[13px] font-semibold text-brand-dark flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <DoorOpen className="w-4 h-4" /> Salir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---------- USUARIOS Y MEMBRESÍAS ---------- */}
          <section>
            <h2 className="font-display font-bold text-brand-deep text-[16px] flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" /> Usuarios ({usuarios.length})
            </h2>

            <div className="space-y-3">
              {usuarios.map((u) => {
                const sel = seleccion[u.uid] || { orgId: "", role: "salesperson" };
                return (
                  <div key={u.uid} className="bg-card border border-hairline rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-semibold text-[14px] text-brand-deep truncate">
                          {u.name || u.email}
                        </p>
                        <p className="text-[12px] text-muted truncate">{u.email}</p>
                      </div>
                      {u.isSuperAdmin && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/15">
                          Super admin
                        </span>
                      )}
                      {!u.active && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-danger border border-red-100">
                          Inactivo
                        </span>
                      )}
                    </div>

                    {u.memberships.filter((m) => m.active).length > 0 ? (
                      <div className="space-y-1.5 mb-2">
                        {u.memberships
                          .filter((m) => m.active)
                          .map((m) => (
                            <div key={m.id} className="flex items-center gap-2 text-[12.5px]">
                              <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                              <span className="flex-1 min-w-0 truncate text-ink/80">
                                {m.organizationName} · <span className="text-muted">{m.role}</span>
                                {u.activeWorkspaceId === m.organizationId && (
                                  <span className="text-brand-dark font-semibold"> (activo)</span>
                                )}
                              </span>
                              <button
                                onClick={() => quitar(u.uid, m.organizationId)}
                                disabled={ocupado}
                                aria-label="Quitar acceso"
                                className="text-danger shrink-0"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-[12.5px] text-muted mb-2">Sin acceso a ningún workspace.</p>
                    )}

                    <div className="flex gap-2">
                      <select
                        value={sel.orgId}
                        onChange={(e) => setSeleccion((s) => ({ ...s, [u.uid]: { ...sel, orgId: e.target.value } }))}
                        className={`${input} flex-1`}
                      >
                        <option value="">Workspace…</option>
                        {workspaces.map((w) => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                      <select
                        value={sel.role}
                        onChange={(e) => setSeleccion((s) => ({ ...s, [u.uid]: { ...sel, role: e.target.value } }))}
                        className={`${input} w-32`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => asignar(u.uid)}
                        disabled={ocupado || !sel.orgId}
                        className="h-11 px-3 rounded-xl bg-brand-dark text-white text-[13px] font-semibold disabled:opacity-40"
                      >
                        Asignar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ---------- INVITACIONES ---------- */}
          <section>
            <h2 className="font-display font-bold text-brand-deep text-[16px] flex items-center gap-2 mb-3">
              <MailPlus className="w-4 h-4" /> Invitar usuario
            </h2>

            <div className="space-y-2 mb-4">
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                value={invEmail}
                onChange={(e) => setInvEmail(e.target.value)}
                placeholder="correo@gmail.com"
                className={input}
              />
              <select value={invOrg} onChange={(e) => setInvOrg(e.target.value)} className={input}>
                <option value="">Workspace…</option>
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value)} className={input}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={crearInvitacion}
                disabled={ocupado || !invEmail.trim() || !invOrg}
                className="w-full min-h-[44px] rounded-xl bg-brand-dark text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <MailPlus className="w-4 h-4" /> Crear invitación
              </button>
              <p className="text-[12px] text-muted">
                No se envía ningún correo todavía: dile a la persona que entre a Royal Sales AI con Google
                y su acceso se activa solo.
              </p>
            </div>

            <h3 className="font-display font-semibold text-brand-deep text-[14px] mb-2">
              Invitaciones pendientes ({invitaciones.filter((i) => i.status === "pending").length})
            </h3>
            <div className="space-y-2">
              {invitaciones.filter((i) => i.status === "pending").length === 0 && (
                <p className="text-[13px] text-muted">No hay invitaciones pendientes.</p>
              )}
              {invitaciones
                .filter((i) => i.status === "pending")
                .map((i) => (
                  <div key={i.id} className="flex items-center gap-3 bg-card border border-hairline rounded-xl px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-[14px] text-brand-deep truncate">{i.email}</p>
                      <p className="text-[12px] text-muted truncate">
                        {i.organizationName} · {i.role}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-accent/15">
                        Pendiente
                      </span>
                    </div>
                    <button
                      onClick={() => cancelarInvitacion(i.id)}
                      disabled={ocupado}
                      className="shrink-0 min-h-[40px] px-3 rounded-xl bg-red-50 border border-red-100 text-[13px] font-semibold text-danger disabled:opacity-40"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
            </div>
          </section>

          {/* ---------- MANTENIMIENTO ---------- */}
          <section>
            <h2 className="font-display font-bold text-brand-deep text-[16px] flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4" /> Datos globales
            </h2>
            <button
              onClick={sembrarGarantias}
              disabled={ocupado}
              className="w-full min-h-[44px] rounded-xl bg-brand/[0.06] border border-brand/15 text-[13px] font-semibold text-brand-dark disabled:opacity-50"
            >
              Cargar conocimiento oficial de garantías
            </button>
            <button
              onClick={sembrarFichas}
              disabled={ocupado}
              className="w-full min-h-[44px] rounded-xl bg-brand/[0.06] border border-brand/15 text-[13px] font-semibold text-brand-dark disabled:opacity-50 mt-2"
            >
              Cargar fichas oficiales de producto
            </button>
            <p className="text-[12px] text-muted mt-1.5">
              Se pueden repetir sin duplicar. Solo el administrador de la plataforma puede ejecutarlos.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
