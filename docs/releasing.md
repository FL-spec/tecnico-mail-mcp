# Releasing

A version tag runs [`release.yml`](../.github/workflows/release.yml). It tests, builds, attests the
files, and publishes a GitHub release with `tecnico-mail.mcpb`, `tecnico-mail-mcp.tgz`, and
`SHA256SUMS`. A tag with a suffix, such as `vX.Y.Z-rc.1`, makes a prerelease.

## Cut a release

1. Move `## Unreleased` in `CHANGELOG.md` to a new version heading.
2. Set the version in `package.json`, and run `npm install --package-lock-only`.
3. Merge that to `main`.
4. Run `tecnico-mail-mcp doctor` from a build of `main`, on a real Técnico account. CI can't do this.
5. Tag and push:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

The workflow fails if the tag doesn't match `package.json`, or if a final tag isn't on `main`.

## Turn on npm publishing

Publishing to npm stays off until the package exists there. A maintainer does this once:

1. Log in and publish the first version by hand, with `npm login`, then `npm publish --access public`.
2. On npmjs.com, add a trusted publisher for the package: repository
   `FL-spec/tecnico-mail-mcp`, workflow `release.yml`.
3. Set the repository variable with `gh variable set NPM_PUBLISH --body true`.
4. Change the install commands in `docs/clients.md`, `docs/troubleshooting.md`, and the README to
   `npx -y tecnico-mail-mcp`.

After that, each final version tag publishes with npm provenance, and no token is stored.

## Update the demo

```bash
npm run build && node scripts/demo/record.mjs && node scripts/demo/render.mjs
```

This needs Docker, and uses only fictional mail on a local Dovecot server.
