import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'node_modules/renovate/dist');
const load = (p) => import(pathToFileURL(path.join(dist, p)).href);

const { mergeChildConfig } = await load('config/utils.js');
const { getConfig } = await load('config/defaults.js');
const { flattenUpdates } = await load('workers/repository/updates/flatten.js');

const args = process.argv.slice(2);
const noAutomerge = args[0] === '--no-automerge';
const presets = noAutomerge ? args.slice(1) : args;
if (!presets.length) {
  console.error('usage: node run.mjs [--no-automerge] <preset.json>...');
  process.exit(2);
}

const composed = presets
  .map((p) => JSON.parse(fs.readFileSync(p, 'utf8')))
  .reduce((a, b) => mergeChildConfig(a, b));

const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-test-'));
fs.cpSync(path.join(here, '__fixtures__'), repo, { recursive: true });
fs.writeFileSync(path.join(repo, 'renovate.json'), JSON.stringify(composed));
const git = (...a) => execFileSync('git', a, { cwd: repo, stdio: 'ignore' });
git('init', '-q');
git('add', '-A');
git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'fixture');

const run = spawnSync(
  path.join(here, 'node_modules/.bin/renovate'),
  ['--platform=local', '--dry-run=lookup', '--require-config=optional'],
  {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    env: { ...process.env, LOG_LEVEL: 'debug', LOG_FORMAT: 'json' },
  },
);

let resolved;
let packageFiles;
for (const line of run.stdout.split('\n')) {
  let j;
  try {
    j = JSON.parse(line);
  } catch {
    continue;
  }
  if (j.msg === 'packageFiles with updates') packageFiles = j.config;
  else if (j.config?.packageRules && j.config?.major && !j.config.extends)
    resolved = j.config;
}
if (!resolved || !packageFiles) {
  console.error('renovate lookup gave no config or no package files');
  console.error(run.stderr.slice(-2000));
  process.exit(2);
}

resolved.semanticCommits = 'enabled';
const updates = await flattenUpdates(
  mergeChildConfig(getConfig(), resolved),
  packageFiles,
);

const GITHUB_OWNED = /^(actions|github)\//;
const OS_PM = new Set(['ubuntu', 'debian', 'alpine', 'pnpm', 'npm', 'yarn']);
const VERSION = /^v?\d/;
const isGithubOwnedAction = (u) =>
  u.manager === 'github-actions' &&
  u.depType === 'action' &&
  GITHUB_OWNED.test(u.packageName ?? '');
const isExemptMajor = (u) =>
  isGithubOwnedAction(u) || OS_PM.has(u.packageName) || OS_PM.has(u.depName);
const isV0 = (u) => /^v?0\./.test(u.currentVersion ?? u.currentValue ?? '');
const isBranchPin = (u) =>
  u.manager === 'github-actions' &&
  ['digest', 'pinDigest'].includes(u.updateType) &&
  !VERSION.test(u.currentValue ?? '');

const failures = [];
const fail = (u, why) =>
  failures.push(`${why}: ${u.manager} ${u.depName} ${u.updateType}`);

for (const u of updates) {
  const automerge = u.automerge === true;
  const ticked = u.dependencyDashboardApproval === true;
  if (noAutomerge && automerge) fail(u, 'automerge on with no opt-in');
  if (u.updateType === 'major') {
    if (!isExemptMajor(u) && !ticked) fail(u, 'major opens without a tick');
    if (automerge && !isGithubOwnedAction(u)) fail(u, 'major automerges');
  }
  if (['minor', 'patch'].includes(u.updateType) && isV0(u)) {
    if (!ticked) fail(u, 'v0.x update opens without a tick');
    if (automerge) fail(u, 'v0.x update automerges');
  }
  if (isBranchPin(u) && automerge) fail(u, 'branch-pin digest automerges');
  if (u.updateType === 'replacement' && automerge)
    fail(u, 'replacement automerges');
}
if (resolved.vulnerabilityAlerts?.automerge === true)
  failures.push('vulnerabilityAlerts automerge is on');

const coverage = {
  'uses-with major': (u) => u.depType === 'uses-with' && u.updateType === 'major',
  'GitHub-owned action major': (u) => isGithubOwnedAction(u) && u.updateType === 'major',
  'third-party action major': (u) =>
    u.manager === 'github-actions' && u.depType === 'action' &&
    !GITHUB_OWNED.test(u.packageName ?? '') && u.updateType === 'major',
  'v0.x minor or patch': (u) => isV0(u) && ['minor', 'patch'].includes(u.updateType),
  'branch-pin digest': isBranchPin,
  'npm major': (u) => u.manager === 'npm' && u.updateType === 'major',
  'docker major': (u) => u.datasource === 'docker' && u.updateType === 'major',
  replacement: (u) => u.updateType === 'replacement',
  'lock file maintenance': (u) => u.updateType === 'lockFileMaintenance',
};
for (const [name, test] of Object.entries(coverage))
  if (!updates.some(test)) failures.push(`fixture has no ${name} update`);

for (const u of updates)
  console.log(
    [
      u.manager,
      u.depType ?? '-',
      u.depName ?? '-',
      u.updateType,
      `approval=${u.dependencyDashboardApproval === true}`,
      `automerge=${u.automerge === true}`,
      u.branchName,
    ].join(' | '),
  );
fs.rmSync(repo, { recursive: true, force: true });
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nok: ${updates.length} updates checked`);
