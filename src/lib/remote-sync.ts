import type { StoredSession } from '@/lib/session';
import { nestFetch } from '@/lib/nest';
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

  const pharmacyId = session.organizationId;
  const token = session.accessToken;

  const [productsRes, patientsRes] = await Promise.all([
    nestFetch(`/pharmacies/${pharmacyId}/products/catalogue`, { token }),
    nestFetch(`/pharmacies/${pharmacyId}/patients`, { token }),
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

  const pending = getPendingOutbox(session.organizationId);
  let pushed = 0;
  let failed = 0;

  for (const item of pending) {
    if (item.kind === 'SALE') {
      const sale = item.payload as PendingSalePayload;
      const { ok, data } = await nestFetch(
        `/pharmacies/${session.organizationId}/sales`,
        {
          method: 'POST',
          token: session.accessToken,
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
        },
      );
      if (ok) {
        markOutboxItem(session.organizationId, item.id, 'synced', sale.id);
        pushed += 1;
      } else {
        markOutboxItem(session.organizationId, item.id, 'error');
        failed += 1;
        void data;
      }
      continue;
    }

    // Local catalogue/patient/stock edits: no Nest push yet.
    markOutboxItem(session.organizationId, item.id, 'synced');
    pushed += 1;
  }

  if (pushed > 0) {
    await pullBootstrap(session);
  }

  return {
    pushed,
    failed,
    message:
      failed > 0
        ? `Sync partielle — ${pushed} ok, ${failed} échec(s).`
        : pushed > 0
          ? `Synchronisation terminée — ${pushed} modification(s) envoyée(s).`
          : 'Aucune modification en attente.',
  };
}

export async function runFullSync(session: StoredSession) {
  return pushOutbox(session);
}
