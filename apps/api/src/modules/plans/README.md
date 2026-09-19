# Plans module

Plans are the shop's sellable duration, traffic, device, squad, and price
definitions. Admin CRUD validates all fields with Zod; public reads expose only
active, public, non-deleted plans ordered by `sortOrder`.

Public plans use the Valkey key `rr:plans:public` with a 60 second TTL. Any
create, update, or soft delete invalidates the key. Deletion checks immutable
transactions first and returns `PLAN_HAS_SALES` when the plan has been sold;
such a plan can only be deactivated.
