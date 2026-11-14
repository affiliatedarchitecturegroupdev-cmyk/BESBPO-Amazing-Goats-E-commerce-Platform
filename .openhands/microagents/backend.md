---
name: backend
type: knowledge
version: 1.0.0
agent: CodeActAgent
triggers: [nestjs, service, migration, postgres, rbac]
---
Backend rules: NestJS modules under services/, schema per bounded context in db/migrations, money in integer cents, RBAC via @RequirePermissions, pure business functions with vitest specs.
