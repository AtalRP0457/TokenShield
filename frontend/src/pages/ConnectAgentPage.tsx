import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, KeyRound, Plug, Terminal } from 'lucide-react';
import { CodeBlock } from '../components/ui/CodeBlock';
import { config } from '../services';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';

/** Where agents send events. Agents talk to the backend directly (not through the dashboard). */
const BACKEND = config.apiBaseUrl || 'http://localhost:8000';
/** Online, the key is the random API_KEY Render generated; locally it's the default. */
const AGENT_KEY = config.apiBaseUrl ? 'YOUR_API_KEY' : 'development-key';


function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-bronze/15 font-mono text-sm text-bronze">{n}</span>
      <div className="min-w-0 flex-1 space-y-3 pb-2">
        <h3 className="pt-0.5 text-sm font-medium text-fg">{title}</h3>
        {children}
      </div>
    </li>
  );
}

const PY_SETUP = `# from the TokenShield repo
pip install requests
export PYTHONPATH=$PWD/sdk`;

const PY_AGENT = `from tokenshield import TokenShield, TokenShieldPaused

shield = TokenShield(api_url="${BACKEND}", api_key="${AGENT_KEY}")
agent = shield.register_agent(name="My Research Agent",
                              description="Summarises papers")

try:
    # Report every tool call your agent makes:
    agent.log_tool_call("web_search", success=True,
                        input_tokens=500, output_tokens=200,
                        model="gemini-3.5-flash-lite", args={"q": "vector databases"})

    # ...and failures too, so TokenShield can spot loops and storms:
    agent.log_tool_call("http_get", success=False, error="HTTP 503",
                        args={"url": "https://example.com"})
except TokenShieldPaused:
    print("TokenShield stopped this agent. Check the Perils page.")
    # end the task here`;

const CURL = `# 1. Register (returns an agent_id)
curl -X POST ${BACKEND}/api/agents/register \\
  -H "X-API-Key: ${AGENT_KEY}" -H "Content-Type: application/json" \\
  -d '{"name": "My Node Agent"}'

# 2. Report each step; stop when the reply says "should_stop": true
curl -X POST ${BACKEND}/api/events \\
  -H "X-API-Key: ${AGENT_KEY}" -H "Content-Type: application/json" \\
  -d '{"agent_id": "<agent_id>", "task_id": "task-1", "tool_name": "web_search",
       "input_tokens": 500, "output_tokens": 200, "success": true}'`;

export function ConnectAgentPage() {
  const [tab, setTab] = useState<'python' | 'http'>('python');

  return (
    <>
      <PageHeader
        title="Summon a hero"
        description="Connect your own AI agent to TokenShield in three steps. Any agent, any model, any language."
      />

      {config.useMock && (
        <div className="mb-4 flex gap-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-4 text-sm text-fg-muted">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-violet-300" />
          <p>
            This dashboard is running in <span className="text-fg">demo mode</span> with simulated agents. To connect real agents, run the TokenShield backend
            and set <code className="font-mono text-xs text-fg">VITE_USE_MOCK=false</code>. See the README on GitHub.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Connect an agent" description="Your agent reports each step; TokenShield watches, catches perils and tells it when to stop." />
          <CardBody>
            <ol className="space-y-6">
              <Step n={1} title="Get your API key">
                <p className="text-sm text-fg-muted">
                  Agents authenticate with the <code className="font-mono text-xs text-fg">API_KEY</code> from the backend's <code className="font-mono text-xs text-fg">.env</code>{' '}
                  (default <code className="font-mono text-xs text-fg">development-key</code>). Send it in the <code className="font-mono text-xs text-fg">X-API-Key</code> header.
                </p>
              </Step>

              <Step n={2} title="Add TokenShield to your agent">
                <div className="flex gap-1" role="tablist" aria-label="Integration method">
                  {(['python', 'http'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={cn('rounded-lg px-3 py-1.5 text-xs transition-colors', tab === t ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg')}
                    >
                      {t === 'python' ? 'Python SDK' : 'Any language (HTTP)'}
                    </button>
                  ))}
                </div>
                {tab === 'python' ? (
                  <>
                    <CodeBlock label="SDK setup" code={PY_SETUP} />
                    <CodeBlock label="Python agent" code={PY_AGENT} />
                  </>
                ) : (
                  <CodeBlock label="HTTP requests" code={CURL} />
                )}
              </Step>

              <Step n={3} title="Run it and watch">
                <p className="text-sm text-fg-muted">
                  Your agent appears on <Link to="/agents" className="text-accent hover:underline">Heroes</Link> as soon as it registers, and its steps stream
                  into the <Link to="/activity" className="text-accent hover:underline">Ship's log</Link>. If it loops, keeps failing or blows its budget,
                  TokenShield raises a <Link to="/incidents" className="text-accent hover:underline">peril</Link>, pauses it, and Gemini explains why.
                </p>
                <CodeBlock label="Example agent" code={`PYTHONPATH=sdk python3 sdk/example_agent.py`} />
              </Step>
            </ol>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="What to report" />
            <CardBody>
              <ul className="space-y-2 text-sm text-fg-muted">
                <li><span className="text-fg">tool_name</span>: which tool was called</li>
                <li><span className="text-fg">success / error</span>: so failure storms are caught</li>
                <li><span className="text-fg">input / output tokens</span>: for cost estimates and budgets</li>
                <li><span className="text-fg">args</span>: hashed, never stored raw; used to spot repeats</li>
                <li><span className="text-fg">task_id</span>: groups steps into tasks</li>
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="How stopping works" />
            <CardBody className="space-y-2 text-sm text-fg-muted">
              <p className="flex gap-2"><Plug className="mt-0.5 size-4 shrink-0 text-bronze" />Every event gets a reply with <code className="font-mono text-xs text-fg">should_stop</code>.</p>
              <p className="flex gap-2"><KeyRound className="mt-0.5 size-4 shrink-0 text-bronze" />The SDK raises <code className="font-mono text-xs text-fg">TokenShieldPaused</code> when it's true.</p>
              <p className="flex gap-2"><Terminal className="mt-0.5 size-4 shrink-0 text-bronze" />Resume from the agent's page once the cause is fixed.</p>
            </CardBody>
          </Card>
          <Link to="/agents"><Button className="w-full" icon={Plug}>View connected heroes</Button></Link>
        </div>
      </div>
    </>
  );
}
