---
'@remnaray/api': patch
---

Reset the panel traffic when a customer renews the same plan (section 10.4), including after it expired, and on a paid plan change when the new limit is below the traffic already used (FR-023). The reset is its own `panel.reset-traffic` job, written with the payment and ahead of the sync, because syncs of one user are deduplicated and would drop a reason carried on them.
