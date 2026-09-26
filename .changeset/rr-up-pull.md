---
'remnaray': patch
---

`./scripts/rr up` pulls the images first when `RR_VERSION` is not a release tag, such as the `dev` of the images workflow, so an older copy left on the server no longer starts; `--pull` does the same for a release.
