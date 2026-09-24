import { useMemo, useState } from 'react';
import type { StoredSession } from '@/lib/session';
import { formatMoney } from '@/data/store';
import { useNestList, asList } from '@/hooks/useNestList';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Fournisseur = {
  id: string;
  nom: string;
  contact: string;
  telephone: string;
  email: string;
  ville: string;
  categorie: string;
  actif: boolean;
  commandes: number;
  montant_total: number;
  delai_moyen: number | null;
};

type Commande = {
  id: string;
  fournisseur: string;
  articles: number;
  montant: number;
  statut: string;
  date: string;
  livraison: string;
};

type Props = {
  session: StoredSession;
  online: boolean;
  locked?: boolean;
};

export function FournisseursPage({ session, online, locked }: Props) {
  const [tab, setTab] = useState<'fournisseurs' | 'commandes'>('fournisseurs');
  const [search, setSearch] = useState('');

  const {
    rows: fournisseurs,
    loading: fLoading,
    error: fError,
  } = useNestList<Fournisseur>({
    session,
    online,
    path: `/pharmacies/${session.organizationId}/fournisseurs`,
    pick: (data) => asList<Fournisseur>(data, 'fournisseurs'),
    deps: [session.organizationId],
  });

  const {
    rows: commandes,
    loading: cLoading,
    error: cError,
  } = useNestList<Commande>({
    session,
    online,
    path:
      tab === 'commandes'
        ? `/pharmacies/${session.organizationId}/fournisseurs/orders`
        : null,
    pick: (data) => asList<Commande>(data, 'commandes'),
    deps: [session.organizationId, tab],
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter(
      (f) =>
        f.nom.toLowerCase().includes(q) ||
        (f.ville || '').toLowerCase().includes(q) ||
        (f.contact || '').toLowerCase().includes(q),
    );
  }, [fournisseurs, search]);

  const fPage = usePagination(filtered, 10);
  const cPage = usePagination(commandes, 10);

  if (tab === 'fournisseurs') {
    if (fLoading) return <p className="muted">Chargement des fournisseurs…</p>;
    if (fError) return <div className="error-box">{fError}</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button
          type="button"
          className={`btn btn-outline${tab === 'fournisseurs' ? ' active' : ''}`}
          disabled={locked}
          onClick={() => setTab('fournisseurs')}
        >
          Fournisseurs
        </button>
        <button
          type="button"
          className={`btn btn-outline${tab === 'commandes' ? ' active' : ''}`}
          disabled={locked}
          onClick={() => setTab('commandes')}
        >
          Commandes
        </button>
      </div>

      {tab === 'fournisseurs' ? (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="label">Fournisseurs</div>
              <div className="value">{fournisseurs.length}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Actifs</div>
              <div className="value">{fournisseurs.filter((f) => f.actif).length}</div>
            </div>
            <div className="kpi-card">
              <div className="label">Commandes</div>
              <div className="value">
                {fournisseurs.reduce((s, f) => s + (f.commandes || 0), 0)}
              </div>
            </div>
          </div>
          <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
            <input
              className="input"
              placeholder="Rechercher…"
              value={search}
              disabled={locked}
              onChange={(e) => {
                setSearch(e.target.value);
                fPage.setPage(1);
              }}
            />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Contact</th>
                  <th>Ville</th>
                  <th>Catégorie</th>
                  <th>Commandes</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {fPage.pageItems.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.nom}</strong>
                      <div style={{ color: 'var(--color-muted)', fontSize: '0.72rem' }}>
                        {f.email || f.telephone || '—'}
                      </div>
                    </td>
                    <td>{f.contact || '—'}</td>
                    <td>{f.ville || '—'}</td>
                    <td>{f.categorie || '—'}</td>
                    <td>{f.commandes}</td>
                    <td>{formatMoney(f.montant_total || 0)}</td>
                    <td>
                      <span className={`badge ${f.actif ? 'badge-teal' : 'badge-warning'}`}>
                        {f.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="empty">Aucun fournisseur.</p>}
          </div>
          <Pagination
            page={fPage.page}
            totalPages={fPage.totalPages}
            total={fPage.total}
            onPageChange={fPage.setPage}
            disabled={locked}
          />
        </>
      ) : (
        <>
          {cLoading && <p className="muted">Chargement des commandes…</p>}
          {cError && <div className="error-box">{cError}</div>}
          {!cLoading && !cError && (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Fournisseur</th>
                      <th>Articles</th>
                      <th>Montant</th>
                      <th>Date</th>
                      <th>Livraison</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cPage.pageItems.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.fournisseur}</strong>
                        </td>
                        <td>{c.articles}</td>
                        <td>{formatMoney(c.montant)}</td>
                        <td>{c.date}</td>
                        <td>{c.livraison || '—'}</td>
                        <td>
                          <span className="badge badge-teal">{c.statut}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {commandes.length === 0 && <p className="empty">Aucune commande.</p>}
              </div>
              <Pagination
                page={cPage.page}
                totalPages={cPage.totalPages}
                total={cPage.total}
                onPageChange={cPage.setPage}
                disabled={locked}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
