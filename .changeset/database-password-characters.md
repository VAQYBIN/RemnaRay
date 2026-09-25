---
'@remnaray/db': patch
'@remnaray/api': patch
---

A PostgreSQL password may contain any character but a single quote: the application builds its connection URL from the `POSTGRES_*` variables with the password percent-encoded instead of compose pasting it raw into `DATABASE_URL`, and `init-env.sh` writes it single-quoted (or generates one when none is typed).
