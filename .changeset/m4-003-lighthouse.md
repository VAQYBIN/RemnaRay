---
'@remnaray/ui': patch
'@remnaray/web': patch
---

Measure the section 13.2 Lighthouse gate and fix what it found

`pnpm lighthouse` audits the landing in both locales and the signed-in account
against the production stack and fails below performance 90, accessibility 90
and SEO 95 (NFR-010); a `lighthouse` CI job runs it and keeps the reports.

The first run scored 85 on accessibility. `Button` gained `asChild`, so a link
that looks like a button is one element instead of a `<button>` nested in an
`<a>`, and the Telegram login container is a labelled `group` whose injected
iframe is named. The landing and the account now score 100/96/100.
