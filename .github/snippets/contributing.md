Contributions are welcome! Feel free to open an issue or submit a pull request.

```bash
# Install dependencies
bun install

# Generate type stubs
bun run dev:prepare

# Start the playground
bun run dev

# Run tests
bun run test
```

The engine conformance suite (`packages/nuxt-auto-api/test/engines`) runs the same requests on SQLite, libsql
and D1 (Miniflare) every time, and on Postgres, MySQL and PlanetScale when you point it at them:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=autoapi postgres:17-alpine
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=autoapi mysql:8.4 --max-connections=2000
docker run -d --network host ghcr.io/mattrobenolt/ps-http-sim:latest -listen-port=3900 -mysql-dbname=autoapi

AUTOAPI_TEST_PG_URL=postgres://postgres:test@localhost:5432/autoapi \
AUTOAPI_TEST_MYSQL_URL=mysql://root:test@localhost:3306/autoapi \
AUTOAPI_TEST_PLANETSCALE_URL=http://root:test@localhost:3900 \
bun run test
```

### Screenshots

`apps/playground/test/visual.spec.ts` photographs the playground (the admin dashboard, a list, a record, an edit
form with its many-to-many cards, the app pages built on the composables, and an object-level permission state)
at 1440 and 375 px, and CI compares every page against the committed images. The images are the docs' own
(`apps/docs/public/screenshots/`), so a page that changes fails CI until its pictures are refreshed.

The pictures are taken in the Playwright Linux container CI uses (macOS renders fonts differently), so Docker must
be running. From `apps/playground`:

```bash
bun run visual:baseline            # rebuild the demo database, build, serve and refresh every image
bun run visual:baseline admin      # only the images whose name matches, e.g. after changing the admin
bun run visual:baseline --check    # compare without writing, as CI does
```

Look at the changed images before committing them. On a CI failure, the `visual-diff` artifact holds the
expected, actual and diff image of each failing page.
