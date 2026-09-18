type Props = {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function Pagination({ page, totalPages, total, onPageChange, disabled }: Props) {
  if (totalPages <= 1) {
    return total > 0 ? (
      <p className="pagination-meta">{total} élément{total > 1 ? 's' : ''}</p>
    ) : null;
  }

  const pages: (number | '…')[] = [];
  const push = (v: number | '…') => pages.push(v);

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) push(i);
  } else {
    push(1);
    if (page > 3) push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      push(i);
    }
    if (page < totalPages - 2) push('…');
    push(totalPages);
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-meta">
        Page <strong>{page}</strong> / {totalPages} · {total} élément{total > 1 ? 's' : ''}
      </p>
      <div className="pagination-btns">
        <button
          type="button"
          className="pagination-btn"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Précédent
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`e-${idx}`} className="pagination-ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`pagination-btn${p === page ? ' active' : ''}`}
              disabled={disabled}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="pagination-btn"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Suivant
        </button>
      </div>
    </nav>
  );
}
