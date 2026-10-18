# GeneMachine

A free educational browser app and Agent Skill that shows gene-medicine evidence and checks a consumer DNA export locally, for the public, hosted as a static Cloudflare Worker (baney75/GeneMachine).

## Run and check

- Install: `npm ci`
- Check: `npm test`
- Live proof: for a change someone sees on screen, run `npm start`, open http://127.0.0.1:4173/, and repeat the gesture (search a medicine, add a question, try the synthetic example). Browser suites: `npm run test:browser`, `npm run test:design`, `npm run test:appointment` (need `npx playwright install chromium webkit`). If you can't run them, report "untested live" and give the steps.
- Deploy: `npm run deploy` (build, then `wrangler deploy`), then read it back: `curl -sI https://genemachine.magnus-b37.workers.dev/web/`. Deploy only when asked.

## Brand

- Not part of the BarnLabs, NeoRome or Donovan Baney design systems. GeneMachine uses its own tokens (navy, mint, blue, paper) in `web/styles.css`. Reuse those variables; don't add raw hex values.

## Layout

- `web/`: the app (page, script, styles, DNA analysis worker)
- `lib/`: parsing, medicine library, appointment kit and report logic shared by app and tests
- `test/`: `node --test` unit tests
- `scripts/`: local server, build, and Playwright browser flows
- `hosting/`: headers, redirects, robots.txt and sitemap.xml copied into `dist/`
- `docs/`: analytical scope, source register, acceptance criteria, product evaluation
- `SKILL.md`: the Agent Skill procedure
- `wrangler.jsonc`: Cloudflare Worker config

## Hard limits

- Use synthetic fixtures only. No real genome, report or identifying filename in the repo.
- Keep DNA parsing in the browser worker. No analytics, storage APIs or external requests; `test:experience` checks requests and storage.
- Medical claims need dated primary sources. Keep unknown values unknown.

## References

- `README.md`, `SECURITY.md`, `docs/analytical-scope.md`
