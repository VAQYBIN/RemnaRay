# Queues and outbox

`OutboxWriter.enqueue()` writes a queue message through the caller's Prisma
transaction. `OutboxRelay` publishes committed rows to BullMQ with a stable
job ID and marks them only after publication. A crash between those operations
can publish a duplicate, and BullMQ's job ID makes that duplicate harmless;
an uncommitted row is never visible to the relay.
