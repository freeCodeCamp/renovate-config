const up = (updateType, newValue, extra = {}) => {
  const [, major, minor = 0, patch = 0] =
    /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(newValue) ?? [];
  return {
    updateType,
    newValue,
    newVersion: newValue,
    newMajor: +major,
    newMinor: +minor,
    newPatch: +patch,
    ...extra,
  };
};
const dep = (fields, ...updates) => ({
  packageName: fields.depName,
  currentVersion: fields.currentValue,
  ...fields,
  updates,
});
const action = (depName, currentValue, extra = {}) => ({
  depName,
  currentValue,
  depType: 'action',
  datasource: 'github-tags',
  ...extra,
});
const npm = (depName, depType, currentValue) => ({
  depName,
  depType,
  currentValue,
  datasource: 'npm',
});
const docker = (depName, currentValue, depType) => ({
  depName,
  currentValue,
  depType,
  datasource: 'docker',
});
const pin = (c) => ({ newDigest: c.repeat(40), newMajor: undefined });

export const packageFiles = {
  'github-actions': [
    {
      packageFile: '.github/workflows/ci.yml',
      deps: [
        dep(action('actions/checkout', 'v3'), up('major', 'v7'), up('pinDigest', 'v3', pin('a'))),
        dep(action('actions/checkout', 'v4.1.0', { currentDigest: 'b'.repeat(40) }), up('minor', 'v4.3.1'), up('major', 'v7')),
        dep(action('actions/setup-node', 'v3'), up('major', 'v7'), up('pinDigest', 'v3', pin('c'))),
        dep(action('codecov/codecov-action', 'v3'), up('major', 'v6'), up('pinDigest', 'v3', pin('d'))),
        dep(action('pnpm/action-setup', 'v2'), up('major', 'v5')),
        dep(action('softprops/action-gh-release', 'v0.1.14'), up('patch', 'v0.1.15'), up('major', 'v2'), up('pinDigest', 'v0.1.14', pin('e'))),
        dep(action('naomi-lgbt/dependency-pin-check', 'main', { currentVersion: undefined, currentDigest: 'f'.repeat(40) }), up('digest', 'main', pin('0'))),
        dep({ depName: 'node', packageName: 'actions/node-versions', depType: 'uses-with', datasource: 'github-releases', currentValue: '18' }, up('major', '24')),
        dep({ depName: 'pnpm', depType: 'uses-with', datasource: 'npm', currentValue: '8' }, up('major', '10')),
        dep({ depName: 'ubuntu', depType: 'github-runner', datasource: 'github-runners', currentValue: '22.04' }, up('major', '24.04')),
      ],
    },
  ],
  dockerfile: [
    {
      packageFile: 'Dockerfile',
      deps: [
        dep(docker('node', '18-alpine', 'stage'), up('major', '24-alpine')),
        dep(docker('alpine', '3.15', 'final'), up('minor', '3.22')),
      ],
    },
  ],
  'docker-compose': [
    {
      packageFile: 'docker-compose.yml',
      deps: [
        dep(docker('provectuslabs/kafka-ui', 'v0.6.0'), up('minor', 'v0.7.2')),
        dep(docker('redis', '6'), up('major', '8')),
      ],
    },
  ],
  npm: [
    {
      packageFile: 'package.json',
      deps: [
        dep({ ...npm('dayjs', 'dependencies', '1.11.0'), lockedVersion: '1.11.0' }, up('patch', '1.11.19')),
        dep(npm('esbuild', 'dependencies', '0.19.0'), up('minor', '0.25.0')),
        dep(npm('express', 'dependencies', '4.17.0'), up('minor', '4.21.2'), up('major', '5.1.0')),
        dep(npm('messageformat', 'dependencies', '2.3.0'), up('major', '4.0.0'), up('replacement', '4.0.0', { newName: '@messageformat/core' })),
        dep({ ...npm('react', 'dependencies', '17.0.0'), sourceUrl: 'https://github.com/facebook/react' }, up('patch', '17.0.2'), up('major', '19.2.0')),
        dep({ ...npm('react-dom', 'dependencies', '17.0.0'), sourceUrl: 'https://github.com/facebook/react' }, up('patch', '17.0.2'), up('major', '19.2.0')),
        dep(npm('typescript', 'devDependencies', '4.9.5'), up('major', '7.0.0')),
        dep(npm('@types/node', 'devDependencies', '20.0.0'), up('minor', '20.19.0')),
        dep(npm('@types/scheduler', 'devDependencies', '0.26.0'), up('minor', '0.28.0')),
        dep(npm('pnpm', 'packageManager', '8.0.0'), up('minor', '8.15.9'), up('major', '10.0.0')),
      ],
    },
  ],
  nvm: [
    {
      packageFile: '.nvmrc',
      deps: [dep({ depName: 'node', datasource: 'node-version', currentValue: '18' }, up('major', '24'))],
    },
  ],
};
