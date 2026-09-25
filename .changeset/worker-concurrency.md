---
'@remnaray/api': patch
'@remnaray/worker': patch
---

Run the workers at the section 7.3 concurrency (payments 4, notify 5, panel 2, broadcast 1, maintenance 1). Every panel write now holds the section 10.3 lock `rr:lock:panel:<userId>`, so two panel jobs for one user never run at once; a job that finds the lock taken is retried.
