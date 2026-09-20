---
---

Keep test files out of the built packages.

`@remnaray/db`, `@remnaray/remnawave-sdk` and `@remnaray/remnawave-mock`
compiled their tests into `dist` while the ten other packages excluded them.
It shipped test code in the application image, and it made the image build the
only place a test file's types were enforced: a `import { AddressInfo }` that
every test runner and both typechecks accepted failed
`docker build -f deploy/docker/app.Dockerfile` with TS1484. A repository test
now holds every package to the same rule.
