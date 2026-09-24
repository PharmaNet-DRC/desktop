import type { StoredSession } from '@/lib/session';
import { getMemorySession } from '@/lib/session';
import { nestFetch, hydrateMemorySession } from '@/lib/nest';
import {
  applyServerSnapshot,
  getPendingOutbox,
  markOutboxItem,
  type PendingSalePayload,
} from '@/data/store';

/** Download catalogue + patients into local offline DB (Nest direct). */
export async function pullBootstrap(
  session: StoredSession,
): Promise<{ ok: boolean; message?: string }> {
  if (!session.organizationId || session.accessToken === 'demo-token') {
    return { ok: true };
  }

  hydrateMemorySession(session);
  const pharmacyId =
    getMemorySession()?.organizationId ?? session.organizationId;

  const [productsRes, patientsRes] = await Promise.all([
    nestFetch(`/pharmacies/${pharmacyId}/products/catalogue`),
    nestFetch(`/pharmacies/${pharmacyId}/patients`),
  ]);

  if (!productsRes.ok) {
    return {
      ok: false,
      message:
        productsRes.data?.message ??
        'Impossible de télécharger le catalogue depuis le serveur.',
    };
  }

  const productsRaw = Array.isArray(productsRes.data)
    ? productsRes.data
    : productsRes.data?.data ?? productsRes.data?.products ?? [];

  const patientsRaw = patientsRes.ok
    ? Array.isArray(patientsRes.data)
      ? patientsRes.data
      : patientsRes.data?.patients ?? patientsRes.data?.data ?? []
    : [];

  applyServerSnapshot(pharmacyId, {
    products: productsRaw,
    patients: patientsRaw,
  });
  return { ok: true };
}

/** Push pending sales to Nest, then refresh catalogue. */
export async function pushOutbox(session: StoredSession): Promise<{
  pushed: number;
  failed: number;
  message: string;
}> {
  if (!session.organizationId || session.accessToken === 'demo-token') {
    const pending = getPendingOutbox(session.organizationId);
    for (const item of pending) {
      markOutboxItem(session.organizationId, item.id, 'synced');
    }
    return {
      pushed: pending.length,
      failed: 0,
      message:
        pending.length > 0
          ? `Mode démo — ${pending.length} élément(s) marqué(s) synchronisé(s).`
          : 'Aucune modification en attente.',
    };
  }

  hydrateMemorySession(session);
  const pharmacyId =
    getMemorySession()?.organizationId ?? session.organizationId;
  const pending = getPendingOutbox(pharmacyId);
  let pushed = 0;
  let failed = 0;

  for (const item of pending) {
    if (item.kind === 'SALE') {
      const sale = item.payload as PendingSalePayload;
      const { ok } = await nestFetch(`/pharmacies/${pharmacyId}/sales`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: sale.paymentMethod,
          items: sale.items.map((i) => ({
            productId: i.productId,
            quantity: i.qte,
          })),
          patientName: sale.patientName || undefined,
          prescriptionReference: sale.prescriptionReference || undefined,
          amountReceived: sale.amountReceived,
        }),
      });
      if (ok) {
        markOutboxItem(pharmacyId, item.id, 'synced', sale.id);
        pushed += 1;
      } else {
        markOutboxItem(pharmacyId, item.id, 'error');
        failed += 1;
      }
    } else {
      markOutboxItem(pharmacyId, item.id, 'synced');
      pushed += 1;
    }
  }

  if (pushed > 0) {
    await pullBootstrap(getMemorySession() ?? session);
  }

  return {
    pushed,
    failed,
    message:
      failed > 0
        ? `${pushed} synchronisé(s), ${failed} échec(s).`
        : pushed > 0
          ? `${pushed} élément(s) synchronisé(s).`
          : 'Aucune modification en attente.',
  };
}

/** Push outbox then pull catalogue — used by auto-sync / Sync page. */
export async function runFullSync(session: StoredSession): Promise<{
  pushed: number;
  failed: number;
  message: string;
}> {
  const push = await pushOutbox(session);
  const pull = await pullBootstrap(getMemorySession() ?? session);
  if (!pull.ok) {
    return {
      ...push,
      message:
        push.pushed > 0
          ? `${push.message} Puis: ${pull.message ?? 'échec du téléchargement.'}`
          : pull.message ?? 'Échec du téléchargement du catalogue.',
    };
  }
  if (push.pushed === 0 && push.failed === 0) {
    return {
      pushed: 0,
      failed: 0,
      message: 'Catalogue à jour.',
    };
  }
  return push;
}
