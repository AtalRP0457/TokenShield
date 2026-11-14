import { useMemo, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { api } from '../services';
import { useApiQuery } from '../hooks/useApiQuery';
import type { AgentStatus } from '../types/api';
import { AGENT_STATUS } from '../lib/labels';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SearchInput } from '../components/ui/SearchInput';
import { Select } from '../components/ui/Select';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { AgentTable, type AgentSortKey } from '../components/agents/AgentTable';

export function AgentsPage() {
  const agents = useApiQuery(() => api.getAgents(), [], { refreshMs: 10_000 });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | AgentStatus>('all');
  const [sortKey, setSortKey] = useState<AgentSortKey>('total_cost_usd');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (agents.data ?? [])
      .filter((a) => status === 'all' || a.status === status)
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.model.toLowerCase().includes(q) || a.id.toLowerCase().includes(q))
      .sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [agents.data, query, status, sortKey, sortDir]);

  const onSort = (key: AgentSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <>
      <PageHeader
        title="Agents"
        description="Every agent registered with TokenShield. Select one for detailed monitoring."
        actions={<Button size="sm" icon={RefreshCw} loading={agents.fetching && !agents.loading} onClick={() => void agents.refetch()}>Refresh</Button>}
      />
      <Card>
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search by name, model or ID" className="sm:w-72" />
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | AgentStatus)}
            options={[{ value: 'all', label: 'All statuses' }, ...Object.entries(AGENT_STATUS).map(([value, m]) => ({ value, label: m.label }))]}
            className="sm:w-40"
          />
          {agents.data && <p className="whitespace-nowrap text-xs text-fg-subtle sm:ml-auto">{visible.length} of {agents.data.length} agents</p>}
        </div>

        {agents.error ? (
          <ErrorState error={agents.error} onRetry={agents.refetch} title="Could not load agents" />
        ) : agents.loading ? (
          <LoadingState rows={6} className="p-4" />
        ) : agents.data!.length === 0 ? (
          <EmptyState icon={Bot} title="No agents registered" description="Agents appear here after they call POST /api/agents/register." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No matching agents"
            description="Try a different search or status filter."
            action={<Button size="sm" onClick={() => { setQuery(''); setStatus('all'); }}>Clear filters</Button>}
          />
        ) : (
          <AgentTable agents={visible} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        )}
      </Card>
    </>
  );
}
