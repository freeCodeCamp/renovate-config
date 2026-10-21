import fs from 'node:fs';
import { mergeChildConfig } from 'renovate/dist/config/utils.js';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { resolveConfigPresets } from 'renovate/dist/config/presets/index.js';
import { flattenUpdates } from 'renovate/dist/workers/repository/updates/flatten.js';
import { packageFiles } from './updates.mjs';

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
const { config: resolved } = await resolveConfigPresets(composed);
const updates = await flattenUpdates(
  mergeChildConfig(getConfig(), { ...resolved, semanticCommits: 'enabled' }),
  packageFiles,
);

const GITHUB_OWNED = /^(actions|github)\//;
const OS_PM = new Set(['ubuntu', 'debian', 'alpine', 'pnpm', 'npm', 'yarn']);
const STABLE_TAG = /^v?[1-9]/;
const isGithubOwnedAction = (u) =>
  u.manager === 'github-actions' &&
  u.depType === 'action' &&
  GITHUB_OWNED.test(u.packageName ?? '');
const isExemptMajor = (u) =>
  isGithubOwnedAction(u) || OS_PM.has(u.packageName) || OS_PM.has(u.depName);
const version = (u) =>
  u.lockedVersion ?? u.currentVersion ?? u.currentValue ?? '';
const isV0 = (u) => /^v?0\./.test(version(u));
const isActionDigest = (u) =>
  u.manager === 'github-actions' &&
  ['digest', 'pinDigest'].includes(u.updateType);
const isHeldDigest = (u) =>
  isActionDigest(u) && !STABLE_TAG.test(u.currentValue ?? '');

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
  if (isHeldDigest(u) && automerge) fail(u, 'held digest automerges');
  if (u.updateType === 'replacement' && automerge)
    fail(u, 'replacement automerges');
}
const branches = Map.groupBy(updates, (u) => u.branchName);
for (const [name, members] of branches) {
  const automerges = members.map((u) => u.automerge === true);
  if (automerges.includes(true) && automerges.includes(false))
    failures.push(`branch mixes automerge and held updates: ${name}`);
}
if (resolved.vulnerabilityAlerts?.automerge === true)
  failures.push('vulnerabilityAlerts automerge is on');

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
if (failures.length) {
  console.error(`\n${failures.length} failure(s):\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`\nok: ${updates.length} updates checked`);
