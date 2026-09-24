---
'@remnaray/api': patch
---

Apply payments found by status polling (section 7.3). CryptoBot and Lava stored every poll under one event id, so the `paid` answer was dropped as a duplicate of the first `pending` one; a polled payment also skipped the underpayment check (EX-12), because the rouble amount the provider reported was not recorded.
