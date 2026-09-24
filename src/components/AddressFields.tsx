import { useEffect, useMemo, useState } from 'react';
import { nestFetch } from '@/lib/nest';

export type AddressValue = {
  country: string;
  province: string;
  city: string;
  quartier: string;
  rue: string;
};

export const emptyAddressValue = (): AddressValue => ({
  country: 'CD',
  province: '',
  city: '',
  quartier: '',
  rue: '',
});

type Town = {
  slug: string;
  name: string;
  province: string;
  countryCode?: string;
};

type Quartier = {
  name: string;
  commune: string | null;
};

type Props = {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  required?: boolean;
  showRue?: boolean;
  disabled?: boolean;
};

/**
 * Cascading address fields — same order as web pharmacy dashboard:
 * Pays → Province → Ville → Quartier → Rue.
 */
export function AddressFields({
  value,
  onChange,
  required = true,
  showRue = true,
  disabled,
}: Props) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [towns, setTowns] = useState<Town[]>([]);
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingTowns, setLoadingTowns] = useState(false);
  const [loadingQuartiers, setLoadingQuartiers] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingProvinces(true);
      const country = value.country || 'CD';
      const { ok, data } = await nestFetch(
        `/locations/provinces?country=${encodeURIComponent(country)}`,
      );
      if (cancelled) return;
      if (!ok) {
        setProvinces([]);
        setLoadingProvinces(false);
        return;
      }
      const list = Array.isArray(data?.provinces)
        ? data.provinces.map((p: { name?: string } | string) =>
            typeof p === 'string' ? p : String(p?.name ?? ''),
          )
        : [];
      setProvinces(list.filter(Boolean));
      setLoadingProvinces(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [value.country]);

  useEffect(() => {
    if (!value.province) {
      setTowns([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingTowns(true);
      const params = new URLSearchParams({
        country: value.country || 'CD',
        province: value.province,
      });
      const { ok, data } = await nestFetch(`/locations/towns?${params}`);
      if (cancelled) return;
      if (!ok) {
        setTowns([]);
        setLoadingTowns(false);
        return;
      }
      const list = Array.isArray(data?.towns) ? data.towns : [];
      setTowns(
        list.map((t: Record<string, any>) => ({
          slug: String(t.slug ?? ''),
          name: String(t.name ?? ''),
          province: String(t.province ?? value.province),
          countryCode: t.countryCode,
        })),
      );
      setLoadingTowns(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [value.country, value.province]);

  const selectedTown = useMemo(
    () => towns.find((t) => t.name === value.city) ?? null,
    [towns, value.city],
  );

  useEffect(() => {
    if (!selectedTown?.slug) {
      setQuartiers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingQuartiers(true);
      const { ok, data } = await nestFetch(
        `/locations/towns/${encodeURIComponent(selectedTown.slug)}/quartiers`,
      );
      if (cancelled) return;
      if (!ok) {
        setQuartiers([]);
        setLoadingQuartiers(false);
        return;
      }
      const list = Array.isArray(data?.quartiers) ? data.quartiers : [];
      setQuartiers(
        list.map((q: Record<string, any>) => ({
          name: String(q.name ?? ''),
          commune: (q.commune as string | null) ?? null,
        })),
      );
      setLoadingQuartiers(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTown]);

  const grouped = useMemo(() => {
    const map = new Map<string, Quartier[]>();
    for (const q of quartiers) {
      if (!q.name) continue;
      const key = q.commune || 'Autres';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return [...map.entries()];
  }, [quartiers]);

  return (
    <div className="address-fields">
      <label className="pharmacy-add-label">
        Pays {required ? '*' : ''}
        <select
          className="input"
          required={required}
          disabled={disabled}
          value={value.country || 'CD'}
          onChange={(e) =>
            onChange({
              ...value,
              country: e.target.value,
              province: '',
              city: '',
              quartier: '',
            })
          }
        >
          <option value="CD">République démocratique du Congo (RDC)</option>
        </select>
      </label>

      <label className="pharmacy-add-label">
        Province {required ? '*' : ''}
        <select
          className="input"
          required={required}
          disabled={disabled || loadingProvinces}
          value={value.province}
          onChange={(e) =>
            onChange({
              ...value,
              province: e.target.value,
              city: '',
              quartier: '',
            })
          }
        >
          <option value="">
            {loadingProvinces ? 'Chargement…' : 'Choisir une province'}
          </option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="pharmacy-add-label">
        Ville {required ? '*' : ''}
        <select
          className="input"
          required={required}
          disabled={disabled || !value.province || loadingTowns}
          value={value.city}
          onChange={(e) =>
            onChange({ ...value, city: e.target.value, quartier: '' })
          }
        >
          <option value="">
            {!value.province
              ? 'Choisissez d’abord une province'
              : loadingTowns
                ? 'Chargement…'
                : 'Choisir une ville'}
          </option>
          {towns.map((t) => (
            <option key={t.slug || t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="pharmacy-add-label">
        Quartier {required ? '*' : ''}
        <select
          className="input"
          required={required}
          disabled={disabled || !value.city || loadingQuartiers}
          value={value.quartier}
          onChange={(e) => onChange({ ...value, quartier: e.target.value })}
        >
          <option value="">
            {!value.city
              ? 'Choisissez d’abord une ville'
              : loadingQuartiers
                ? 'Chargement…'
                : 'Choisir un quartier'}
          </option>
          {grouped.map(([commune, list]) => (
            <optgroup key={commune} label={commune}>
              {list.map((q) => (
                <option key={q.name} value={q.name}>
                  {q.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {showRue && (
        <label className="pharmacy-add-label address-fields-rue">
          Rue / avenue <span className="address-optional">(optionnel)</span>
          <input
            className="input"
            disabled={disabled}
            value={value.rue}
            placeholder="Ex. Avenue du Lac, n° 12"
            autoComplete="street-address"
            onChange={(e) => onChange({ ...value, rue: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}
