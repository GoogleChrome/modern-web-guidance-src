import { features } from 'web-features';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/wf.ts <query> [--status <baseline>]');
  console.log('Example: node scripts/wf.ts overflow');
  console.log('Example: node scripts/wf.ts o --status low');
  process.exit(0);
}

let query = '';
let statusFilter: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--status') {
    statusFilter = args[i + 1];
    i++;
  } else {
    query = args[i];
  }
}

const matches = Object.entries(features).filter(([id, data]) => {
  const matchesQuery = id.toLowerCase().includes(query.toLowerCase());
  const matchesStatus = !statusFilter || data.status?.baseline === statusFilter;
  return matchesQuery && matchesStatus;
});

if (matches.length === 0) {
  console.log(`No features found matching "${query}"${statusFilter ? ` with status "${statusFilter}"` : ''}.`);
} else {
  console.table(
    matches.map(([id, data]) => ({
      id,
      name: data.name,
      baseline: data.status?.baseline ?? 'unknown',
      support: Object.entries(data.status?.support || {})
        .map(([browser, version]) => `${browser}: ${version}`)
        .join(', '),
    }))
  );
}
