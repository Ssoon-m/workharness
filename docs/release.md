# Release

PhaseHarness publishes two npm packages from the same release tag:

- `phaseharness`
- `create-phaseharness`

Both package versions must match the pushed tag.

```bash
pnpm version 0.1.6 --no-git-tag-version
pnpm --dir packages/create-phaseharness version 0.1.6 --no-git-tag-version
pnpm install
pnpm run release:check

git add .
git commit -m "chore: release v0.1.6"
git tag v0.1.6
git push origin main
git push origin v0.1.6
```

Pushing a `v*` tag runs `.github/workflows/release.yml`. The workflow validates package versions, checks package contents, publishes both packages to npm, and creates a GitHub release.

Stable versions publish to npm `latest`. Prerelease versions publish to a dist-tag derived from the prerelease id:

```bash
0.1.6-next.0 -> next
0.1.6-alpha.0 -> alpha
```

The workflow uses npm trusted publishing with provenance. Configure npm trusted publishing for both packages before using the GitHub Actions release.
