import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { addPatient, listPatients } from '@/data/store';
import { usePagination } from '@/hooks/usePagination';
import { Pagination } from '@/components/Pagination';

type Props = {
  pharmacyId: string;
  refreshKey: number;
  onChanged: () => void;
  locked?: boolean;
};

export function PatientsPage({ pharmacyId, refreshKey, onChanged, locked }: Props) {
  void refreshKey;
  const patients = listPatients(pharmacyId);
  const { page, setPage, totalPages, pageItems, total } = usePagination(patients, 10);
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [patients.length, setPage]);

  function openForm() {
    setNom('');
    setPhone('');
    setError(null);
    setOpen(true);
  }

  function save() {
    if (!nom.trim()) {
      setError('Nom obligatoire');
      return;
    }
    addPatient(pharmacyId, nom, phone);
    setOpen(false);
    onChanged();
  }

  return (
    <div>
      <div className="toolbar">
        <div className="grow" />
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked}
          onClick={openForm}
        >
          <Plus size={16} /> Nouveau patient
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Créé</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((p) => (
              <tr key={p.id}>
                <td>{p.nom}</td>
                <td>{p.phone || '—'}</td>
                <td>{new Date(p.createdAt).toLocaleDateString('fr-CD')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {patients.length === 0 && <p className="empty">Aucun patient. Cliquez sur « Nouveau patient ».</p>}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        disabled={locked}
      />

      {open && (
        <div className="modal-backdrop" onClick={() => !locked && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nouveau patient</h2>
            <div className="form-stack">
              <div className="field">
                <label>Nom</label>
                <input
                  className="input"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Téléphone</label>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={save}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
