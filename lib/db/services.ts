// Capa de acceso a Firestore para datos comerciales.
// Todos los documentos llevan organizationId, isTestData, createdBy y serverTimestamp().
import { db } from "@/lib/firebase/client";
import {
  addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot,
  query, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import type { UserProfile } from "@/types/user";

export type Ctx = { uid: string; profile: UserProfile };

function baseFields(ctx: Ctx) {
  return {
    organizationId: ctx.profile.organizationId,
    isTestData: !!ctx.profile.isTestUser,
    createdBy: ctx.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function isOrgManager(ctx: Ctx) {
  return ctx.profile.role === "distributor" || ctx.profile.role === "reviewer";
}

// ---------- CLIENTES ----------
export async function findCustomerByPhone(ctx: Ctx, phone: string) {
  const snap = await getDocs(query(
    collection(db, "customers"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("phone", "==", phone),
    limit(1)
  ));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
}

export async function createCustomer(ctx: Ctx, data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "customers"), {
    ...data,
    assignedSalespersonId: ctx.uid,
    status: "new",
    ...baseFields(ctx),
  });
  return ref.id;
}

export async function updateCustomer(ctx: Ctx, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "customers", id), { ...data, updatedBy: ctx.uid, updatedAt: serverTimestamp() });
}

export function subscribeCustomers(ctx: Ctx, cb: (rows: any[]) => void, onError?: () => void) {
  // Solo filtros de igualdad: Firestore no requiere índice compuesto. El orden
  // por fecha se hace en memoria para no depender de índices desplegados a mano.
  const clauses: any[] = [where("organizationId", "==", ctx.profile.organizationId)];
  if (!isOrgManager(ctx)) clauses.push(where("assignedSalespersonId", "==", ctx.uid));
  const q = query(collection(db, "customers"), ...clauses);
  return onSnapshot(
    q,
    (snap) => cb(sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })), "createdAt")),
    onError
  );
}

export async function getCustomer(id: string) {
  const snap = await getDoc(doc(db, "customers", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as any : null;
}

// ---------- VISITAS ----------
export async function createVisit(ctx: Ctx, customerId: string) {
  const ref = await addDoc(collection(db, "visits"), {
    customerId,
    salespersonId: ctx.uid,
    status: "in_progress",
    startedAt: serverTimestamp(),
    completedAt: null,
    surveyDraft: null,
    ...baseFields(ctx),
  });
  return ref.id;
}

export async function updateVisit(ctx: Ctx, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, "visits", id), { ...data, updatedBy: ctx.uid, updatedAt: serverTimestamp() });
}

export async function findInProgressVisit(ctx: Ctx) {
  const snap = await getDocs(query(
    collection(db, "visits"),
    where("salespersonId", "==", ctx.uid),
    where("status", "==", "in_progress"),
    limit(1)
  ));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
}

export async function getVisitsForCustomer(ctx: Ctx, customerId: string) {
  const snap = await getDocs(query(
    collection(db, "visits"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("customerId", "==", customerId)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRecentVisits(ctx: Ctx, max = 50) {
  // Sin orderBy en Firestore (evita índice compuesto); ordenamos y recortamos
  // en memoria.
  const clauses: any[] = [where("organizationId", "==", ctx.profile.organizationId)];
  if (!isOrgManager(ctx)) clauses.push(where("salespersonId", "==", ctx.uid));
  const snap = await getDocs(query(collection(db, "visits"), ...clauses));
  const rows = sortByDateDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })), "createdAt");
  return rows.slice(0, max);
}

// ---------- ENCUESTA / PERFIL IA / RESULTADOS ----------
export async function saveSurveyResponses(ctx: Ctx, visitId: string, customerId: string, responses: unknown, internalInfo: unknown) {
  const ref = await addDoc(collection(db, "surveyResponses"), {
    visitId, customerId, salespersonId: ctx.uid, responses, internalInfo, ...baseFields(ctx),
  });
  return ref.id;
}

export async function saveAiProfile(ctx: Ctx, visitId: string, customerId: string, profileData: unknown) {
  const ref = await addDoc(collection(db, "aiProfiles"), {
    visitId, customerId, salespersonId: ctx.uid, profile: profileData, ...baseFields(ctx),
  });
  return ref.id;
}

export async function saveVisitResult(ctx: Ctx, visitId: string, customerId: string, outcome: string, extra: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "visitResults"), {
    visitId, customerId, salespersonId: ctx.uid, outcome, ...extra, ...baseFields(ctx),
  });
  return ref.id;
}

export async function savePurchase(ctx: Ctx, visitId: string, customerId: string, data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "purchases"), {
    visitId, customerId, salespersonId: ctx.uid, ...data, purchaseDate: serverTimestamp(), ...baseFields(ctx),
  });
  return ref.id;
}

// ---------- SEGUIMIENTOS ----------
export async function createFollowup(ctx: Ctx, data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, "followups"), {
    salespersonId: ctx.uid,
    status: "pending",
    completedAt: null,
    ...data,
    ...baseFields(ctx),
  });
  return ref.id;
}

export function subscribeFollowups(ctx: Ctx, cb: (rows: any[]) => void, onError?: () => void) {
  // Solo igualdades: sin índice compuesto. El orden por fecha va en memoria.
  const clauses: any[] = [
    where("organizationId", "==", ctx.profile.organizationId),
    where("status", "==", "pending"),
  ];
  if (!isOrgManager(ctx)) clauses.push(where("salespersonId", "==", ctx.uid));
  const q = query(collection(db, "followups"), ...clauses);
  return onSnapshot(
    q,
    (snap) => cb(sortByDateAsc(snap.docs.map((d) => ({ id: d.id, ...d.data() })), "scheduledAt")),
    onError
  );
}

export async function completeFollowup(ctx: Ctx, id: string) {
  await updateDoc(doc(db, "followups", id), {
    status: "completed", completedAt: serverTimestamp(), updatedBy: ctx.uid, updatedAt: serverTimestamp(),
  });
}

export async function getFollowupsForCustomer(ctx: Ctx, customerId: string) {
  const snap = await getDocs(query(
    collection(db, "followups"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("customerId", "==", customerId)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- INTERACCIONES ----------
export async function logInteraction(ctx: Ctx, customerId: string, followupId: string | null, action: string) {
  await addDoc(collection(db, "customerInteractions"), {
    customerId, followupId, salespersonId: ctx.uid, action, ...baseFields(ctx),
  });
}

export async function getInteractionsForCustomer(ctx: Ctx, customerId: string) {
  const snap = await getDocs(query(
    collection(db, "customerInteractions"),
    where("organizationId", "==", ctx.profile.organizationId),
    where("customerId", "==", customerId)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- utilidades ----------
export function tsToDate(t: any): Date | null {
  if (!t) return null;
  if (typeof t.toDate === "function") return t.toDate();
  if (t instanceof Date) return t;
  return null;
}

// Ordenan en memoria por un campo de fecha. Un documento recién creado con
// serverTimestamp() tiene ese campo momentáneamente en null; lo tratamos como
// "lo más reciente" (desc) o "lo más lejano" (asc) para que aparezca de una vez.
function sortByDateDesc<T extends Record<string, any>>(rows: T[], field: string): T[] {
  return [...rows].sort((a, b) => {
    const da = tsToDate(a[field])?.getTime() ?? Infinity;
    const dbb = tsToDate(b[field])?.getTime() ?? Infinity;
    return dbb - da;
  });
}

function sortByDateAsc<T extends Record<string, any>>(rows: T[], field: string): T[] {
  return [...rows].sort((a, b) => {
    const da = tsToDate(a[field])?.getTime() ?? Infinity;
    const dbb = tsToDate(b[field])?.getTime() ?? Infinity;
    return da - dbb;
  });
}
