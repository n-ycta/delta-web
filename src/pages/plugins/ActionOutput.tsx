import { Badge } from '@/ui/primitives';
function Value({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (typeof value === 'boolean')
    return <Badge tone={value ? 'ok' : 'warn'}>{String(value)}</Badge>;
  if (value === null || value === undefined) return <span className="faint">{'—'}</span>;
  if (depth > 5) return <pre>{JSON.stringify(value, null, 2)}</pre>;
  if (Array.isArray(value))
    return (
      <div className="col gap-2">
        {value.slice(0, 100).map((v, i) => (
          <Value key={i} value={v} depth={depth + 1} />
        ))}
      </div>
    );
  if (typeof value === 'object')
    return (
      <dl className="action-result">
        {Object.entries(value)
          .slice(0, 100)
          .map(([key, v]) => (
            <div key={key}>
              <dt className="muted mono">{key}</dt>
              <dd>
                <Value value={v} depth={depth + 1} />
              </dd>
            </div>
          ))}
      </dl>
    );
  return <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{String(value)}</span>;
}
export function ActionOutput({ lines }: { lines: string[] }) {
  return (
    <div className="col gap-3">
      {lines.map((line, i) => {
        let value: unknown = line;
        try {
          value = JSON.parse(line);
        } catch {}
        return <Value key={i} value={value} />;
      })}
    </div>
  );
}
