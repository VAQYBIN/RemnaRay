---
'@remnaray/api': patch
'@remnaray/remnawave-mock': patch
---

Tag the panel user with the plan's slug, or `TRIAL` (section 10.3), in the form the panel accepts: upper case, `-` as `_`, at most 16 characters. The tag was always `TRIAL` and was never updated, so paid users kept the trial tag. The panel mock now refuses a tag the panel refuses.
