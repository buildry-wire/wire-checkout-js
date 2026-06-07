# Releasing wire-checkout-js (npm: @buildry-wire/checkout)

Releases publish to npm over **OIDC Trusted Publishing** with provenance — no token stored.

## One-time npm setup (browser, maintainer)
1. The `buildry-wire` org already exists at https://www.npmjs.com/org/buildry-wire (public packages are free).
2. On the package settings for `@buildry-wire/checkout`, add a **trusted publisher**:
   - Provider: GitHub Actions
   - Repository: `buildry-wire/wire-checkout-js`
   - Workflow: `release.yml`
3. Save.

### If npm will not let you pre-configure OIDC for a name that has never been published
A brand-new package name cannot always be configured as a trusted publisher before it has ever
been published (chicken-and-egg). Do the first publish once with a short-lived **granular
automation token**, then switch to OIDC:
1. Create a granular token (scope: publish, this package/org) at npmjs.com.
2. Add it as repo secret `NPM_TOKEN` (Settings → Secrets → Actions).
3. Temporarily add to the publish step:
   ```yaml
   - run: npm publish
     env:
       NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```
4. After the first successful publish, configure the trusted publisher (steps above),
   remove the `env:` block and delete the `NPM_TOKEN` secret. **Never commit a token.**

## Cut a release
1. Bump `version` in `package.json`; move changelog items under `## [x.y.z] - YYYY-MM-DD`.
2. Commit on `main`, then:
   ```bash
   git tag vX.Y.Z   # must equal package.json version
   git push origin vX.Y.Z
   ```

## Verify
```bash
npm install @buildry-wire/checkout@X.Y.Z
```
