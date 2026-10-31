# Architecture decisions

## Keep a modular monolith

One repository and database are the default. Feature modules own application behavior. The API and worker have separate lifecycles so scaling HTTP traffic does not automatically scale delivery workers. They share job contracts, configuration, and the same release image.

## Configuration is a startup contract

Required database/JWT settings are validated once. Consumers inject `ConfigService` instead of reading environment variables during module evaluation. Optional integrations initialize on demand. No import should make a network request, create a vendor client from environment state, or require an optional credential.

## Secure new endpoints by default

Global guards authenticate routes unless marked public, then enforce role metadata and opt-in rate policies. JWTs use HS256 and require a known, active database session. Permissions, tenant isolation, and resource ownership belong to the product's feature layer.

## Transactions protect state changes

Registration creates its account and session together. Refresh consumes a session conditionally and creates its replacement in the same transaction. Token hashing happens before opening the transaction to avoid holding database connections during bcrypt work. Business modules should follow the same rule for multi-row invariants.

## HTTP contracts have one owner

Success responses are explicit controller return values. A single global filter maps framework and Prisma failures into the shared error shape. The HTTP setup function is reused by tests so validation, prefix, CORS and middleware match production behavior.

## Infrastructure stays replaceable without hiding everything

The starter uses Prisma directly in feature services and explicit Nest module imports. Do not add a generic repository that simply renames every Prisma method. Introduce narrower repositories when domain invariants, cross-module ownership, or testing boundaries require them. Cross-module writes go through the owning feature's public service.

## Operational work is explicit

Migrations run once per release through the tooling image. Seeds only create reference data. Administrator provisioning is a separate command and never elevates an existing user. Container startup launches its process without mutating production accounts. Nginx terminates public traffic; the API trusts only the configured proxy hop count.

## Extension points

Product-specific additions can include organization tenancy, granular permissions, audit trails, transactional outboxes, idempotency storage, session cleanup schedules, object ownership, and external monitoring. Add these when the application needs their concrete behavior, rather than shipping empty modules that imply guarantees they do not enforce.
