Every pull request publishes a preview package via [pkg.pr.new](https://pkg.pr.new), so you can install and test changes before they are merged.

```bash
# npm
npm install https://pkg.pr.new/@websideproject/nuxt-auto-api@<pr-number>
npm install https://pkg.pr.new/@websideproject/nuxt-auto-admin@<pr-number>

# pnpm
pnpm add https://pkg.pr.new/@websideproject/nuxt-auto-api@<pr-number>
pnpm add https://pkg.pr.new/@websideproject/nuxt-auto-admin@<pr-number>

# bun
bun add https://pkg.pr.new/@websideproject/nuxt-auto-api@<pr-number>
bun add https://pkg.pr.new/@websideproject/nuxt-auto-admin@<pr-number>
```
