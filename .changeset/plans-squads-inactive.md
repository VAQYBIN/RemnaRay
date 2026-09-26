---
'@remnaray/api': patch
'@remnaray/db': patch
---

Take plans without squads off sale on upgrade instead of leaving them selling and uneditable. A plan may keep no squads only while it is inactive or deleted, and putting one on sale without squads is refused with a field error.
