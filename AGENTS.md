# GeneMachine

A free educational browser app and Agent Skill that shows gene-medicine evidence and checks a consumer DNA export locally, for the public, hosted as a static Cloudflare Worker (baney75/GeneMachine).

## Run and check

- Install: Node.js 22+, then `npm ci`
- Check: `npm test`
- Live proof: for a change someone sees on screen, run `npm start`, open http://127.0.0.1:4173/, and repeat the gesture (search a medicine, add a question, try the synthetic example). Browser suites: `npm run test:browser`, `npm run test:design`, `npm run test:appointment`, `npm run test:experience` (need `npx playwright install chromium webkit`). If you can't run them, report "untested live" and give the steps.
- Deploy: `npm run deploy` (build, then `wrangler deploy`). Read it back by comparing live files with the build in `dist/`; this exits nonzero on a stale or failed deploy: `t=$(mktemp -d) && B=https://genemachine.magnus-b37.workers.dev/web && curl -fsS $B/ -o $t/i && cmp $t/i dist/web/index.html && curl -fsS $B/app.js -o $t/a && cmp $t/a dist/web/app.js && curl -fsS $B/styles.css -o $t/s && cmp $t/s dist/web/styles.css`. The root redirects to `/web/` (`hosting/_redirects`). Deploy only when asked.

## Brand

- Not part of the BarnLabs, NeoRome or Donovan Baney design systems. GeneMachine uses its own tokens (navy, mint, blue, paper) in `web/styles.css`. Reuse those variables; don't add raw hex values.

## Layout

- `web/`: the app (page, app and experience scripts, styles, DNA analysis worker)
- `lib/`: parsing, medicine library, appointment kit and report logic shared by app and tests
- `test/`: `node --test` unit tests
- `scripts/`: local server, build, and Playwright browser flows
- `hosting/`: headers, redirects, robots.txt and sitemap.xml copied into `dist/`
- `docs/`: analytical scope, source register, acceptance criteria, product evaluation
- `samples/`: synthetic DNA only: the public example and `samples/reference/` test fixtures (all synthetic; see Hard limits)
- `assets/`: logo, wordmark and social images
- `SKILL.md`: the Agent Skill procedure
- `wrangler.jsonc`: Cloudflare Worker config

## Hard limits

- Use synthetic fixtures only. No real genome, report or identifying filename in the repo.
- In the app, parse user DNA only inside `web/analysis-worker.js` (parsing code lives in `lib/`). Never parse it on the main thread, in `scripts/serve.mjs`, or by sending it anywhere. No analytics, storage APIs or external requests. `npm run test:experience` checks requests and storage; run it for any change touching network, storage or the worker.
- Medical claims need dated primary sources. Keep unknown values unknown.
- Educational only: no dose numbers, no diagnosis, no dose or treatment recommendation, and never match library topics to a user's DNA. The checker reports only the gated SLCO1B1 rs4149056 observation; no star alleles, diplotypes, phenotypes, CYP2D6, HLA, copy number or structural variants without Donovan's sign-off (`docs/analytical-scope.md`). Medical content changes, including DPYD, need qualified human review before merge.

## References

- `README.md`, `SECURITY.md`, `docs/analytical-scope.md`
