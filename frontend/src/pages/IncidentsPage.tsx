import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import type { Incident, IncidentStatus, IncidentType, Severity } from '../types/api';
import { INCIDENT_STATUS, INCIDENT_TYPE, SEVERITY } from '../lib/labels';
import { formatUsd, parseUtc } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { IncidentTable } from '../components/incidents/IncidentTable';

type Filter<T extends string> = 'all' | T;

export function IncidentsPage() {
  const incidents = useApiQuery(() => api.getIncidents(), [], { refreshMs: 3_000 });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Filter<IncidentStatus | 'unresolved'>>('unresolved');
  const [severity, setSeverity] = useState<Filter<Severity>>('all');
  const [type, setType] = useState<Filter<IncidentType>>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = incidents.data ?? [];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((i) => (status === 'all' ? true : status === 'unresolved' ? i.status !== 'resolved' : i.status === status))
      .filter((i) => severity === 'all' || i.severity === severity)
      .filter((i) => type === 'all' || i.incident_type === type)
      .filter((i) => !q || [i.id, i.description, i.agent_name].some((s) => s.toLowerCase().includes(q)))
      .sort((a, b) => parseUtc(b.created_at) - parseUtc(a.created_at));
  }, [all, query, status, severity, type]);

  const unresolved = all.filter((i) => i.status !== 'resolved');
  const openWaste = unresolved.reduce((s, i) => s + i.estimated_waste, 0);

  const resolve = async (incident: Incident) => {
    setResolvingId(incident.id);
    setActionError(null);
    try {
      const updated = await api.updateIncident(incident.id, { status: 'resolved' });
      // Use the server's response as the source of truth for that row.
      incidents.setData((prev) => prev?.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err) {
      setActionError(`Could not resolve ${incident.id}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResolvingId(null);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setSeverity('all');
    setType('all');
  };

  return (
    <>
      <PageHeader
        title="Perils of the voyage"
        description="Incident center · loops, failure storms and budget overruns TokenShield caught."
        actions={
          incidents.data && (
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-xs text-fg-subtle">Unresolved</p>
                <p className="font-mono text-lg font-semibold text-fg tabular-nums">{unresolved.length}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Unresolved waste (est.)</p>
                <p className="font-mono text-lg font-semibold text-orange-300 tabular-nums">{formatUsd(openWaste)}</p>
              </div>
            </div>
          )
        }
      />

      {actionError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">{actionError}</div>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:flex md:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search ID, description or agent" className="col-span-2 md:w-64" />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="md:w-36"
            options={[{ value: 'unresolved', label: 'Unresolved' }, { value: 'all', label: 'All statuses' }, ...Object.entries(INCIDENT_STATUS).map(([value, m]) => ({ value, label: m.label }))]} />
          <Select aria-label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="md:w-36"
            options={[{ value: 'all', label: 'All severities' }, ...Object.entries(SEVERITY).filter(([value]) => value !== 'low').map(([value, m]) => ({ value, label: m.label }))]} />
          <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className="col-span-2 md:w-60"
            options={[{ value: 'all', label: 'All types' }, ...Object.entries(INCIDENT_TYPE).map(([value, m]) => ({ value, label: `${m.peril} · ${m.label}` }))]} />
          {incidents.data && <p className="col-span-2 whitespace-nowrap text-xs text-fg-subtle md:ml-auto">{visible.length} shown</p>}
        </div>

        {incidents.error ? (
          <ErrorState error={incidents.error} onRetry={incidents.refetch} title="Could not load incidents" />
        ) : incidents.loading ? (
          <LoadingState rows={6} className="p-4" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={all.length === 0 ? 'Calm seas · no incidents' : 'No incidents match these filters'}
            description={all.length === 0 ? 'Your agents are behaving. Incidents appear here when TokenShield detects risky behaviour.' : status === 'unresolved' ? 'Everything is resolved. Show all statuses to see history.' : undefined}
            action={all.length > 0 && <Button size="sm" onClick={resetFilters}>Show all incidents</Button>}
          />
        ) : (
          <IncidentTable incidents={visible} onResolve={(i) => void resolve(i)} resolvingId={resolvingId} />
        )}
      </Card>
    </>
  );
}
