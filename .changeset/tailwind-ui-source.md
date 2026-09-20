---
---

Let Tailwind see the UI kit.

Automatic source detection skips `node_modules`, which is the only place
`apps/web` can see `@remnaray/ui` from, so the stylesheet carried just the
classes the application itself happened to use. Every class the kit alone
owned was missing: buttons lost `px-4 py-2` and looked cramped, a disabled
button lost `opacity-50` and looked identical to an enabled one, and the toast
viewport lost the `fixed`, `z-100` and `max-w-sm` that put it on the screen —
so errors were reported to a toast nobody could see. An `@source` for the kit
takes the stylesheet from 16 KB to 27 KB.
