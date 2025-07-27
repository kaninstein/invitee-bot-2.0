# 🗄️ Sistema de Migrations

Este projeto usa um sistema robusto de migrations para gerenciar o schema do banco de dados PostgreSQL.

## 📋 Visão Geral

As migrations são scripts que modificam o banco de dados de forma controlada e versionada. Cada migration tem:

- **ID único**: Número sequencial (001, 002, 003...)
- **Nome descritivo**: Descreve o que a migration faz
- **Função `up()`**: Aplica as mudanças
- **Função `down()`**: Reverte as mudanças (rollback)

## 🚀 Comandos Disponíveis

### Executar Migrations Pendentes
```bash
npm run migrate:up
# ou
npm run migrate up
```

### Ver Status das Migrations
```bash
npm run migrate:status
# ou
npm run migrate status
```

### Fazer Rollback da Última Migration
```bash
npm run migrate:down
# ou
npm run migrate down
```

### Criar Nova Migration
```bash
npm run migrate:create "nome_da_migration"
# ou
npm run migrate create "add_user_avatar"
```

### Forçar Re-execução de Migration
```bash
npm run migrate force 001
```

## 📁 Estrutura de Arquivos

```
src/database/
├── migrations/           # Arquivos de migrations
│   ├── 001_create_users_table.ts
│   ├── 002_create_verification_sessions_table.ts
│   ├── 003_create_user_activities_table.ts
│   └── 004_create_system_settings_table.ts
├── migrationRunner.ts    # Sistema de execução
└── README.md            # Esta documentação
```

## 🔧 Como Criar uma Migration

1. **Gerar o arquivo**:
   ```bash
   npm run migrate:create "add_user_avatar"
   ```

2. **Editar o arquivo gerado** (`005_add_user_avatar.ts`):
   ```typescript
   import { database } from '../../config/database';
   import { Migration } from '../migrationRunner';

   const migration: Migration = {
     id: '005',
     name: 'add_user_avatar',
     
     async up(): Promise<void> {
       await database.query(`
         ALTER TABLE users 
         ADD COLUMN avatar_url VARCHAR(500),
         ADD COLUMN avatar_updated_at TIMESTAMP;
       `);
       
       await database.query(`
         CREATE INDEX idx_users_avatar_updated ON users(avatar_updated_at);
       `);
     },

     async down(): Promise<void> {
       await database.query(`
         ALTER TABLE users 
         DROP COLUMN avatar_url,
         DROP COLUMN avatar_updated_at;
       `);
     }
   };

   export default migration;
   ```

3. **Executar a migration**:
   ```bash
   npm run migrate:up
   ```

## 📊 Migrations Existentes

### 001 - Create Users Table
- Cria tabela `users` principal
- Campos: telegram_id, username, blofin_uid, etc.
- Índices para performance
- Trigger para `updated_at` automático

### 002 - Create Verification Sessions Table
- Cria tabela `verification_sessions`
- Gerencia sessões de verificação temporárias
- Foreign key para `users`
- Índices otimizados

### 003 - Create User Activities Table
- Cria tabela `user_activities` para auditoria
- Logs de todas as ações do usuário
- Suporte a JSONB para dados flexíveis
- Preparado para particionamento

### 004 - Create System Settings Table
- Cria tabela `system_settings`
- Configurações dinâmicas do sistema
- Tipos de dados configuráveis
- Settings públicas e privadas

## 🔄 Execução Automática

As migrations são executadas automaticamente na inicialização da aplicação:

```typescript
// Em startupService.ts
await migrationRunner.runPendingMigrations();
```

## 🛡️ Segurança e Boas Práticas

### ✅ Boas Práticas

1. **Sempre teste migrations** em ambiente de desenvolvimento primeiro
2. **Faça backup** antes de executar migrations em produção
3. **Use transações** - o sistema já faz isso automaticamente
4. **Não modifique** migrations já executadas
5. **Implemente sempre** a função `down()` para rollback
6. **Use nomes descritivos** para migrations

### ⚠️ Cuidados

1. **Não delete** arquivos de migration já executados
2. **Não modifique** o conteúdo de migrations já aplicadas
3. **Teste rollbacks** antes de aplicar em produção
4. **Considere dependências** entre migrations

## 🔍 Monitoramento

### Logs
Todas as operations de migration são logadas:
```
[INFO] MIGRATIONS: Executando migration: 001 - create_users_table
[INFO] MIGRATIONS: ✅ Migration 001 executada em 245ms
```

### Tabela de Controle
O sistema mantém uma tabela `migrations` com:
- ID da migration
- Nome da migration
- Data de execução
- Checksum do arquivo

### Health Check
O status das migrations é incluído no health check:
```
GET /health/detailed
```

## 🆘 Troubleshooting

### Migration Falhou
```bash
# Ver status
npm run migrate:status

# Fazer rollback se necessário
npm run migrate:down

# Corrigir o problema e tentar novamente
npm run migrate:up
```

### Migration Inconsistente
```bash
# Forçar re-execução (cuidado!)
npm run migrate force 001
```

### Rollback em Produção
```bash
# Fazer backup primeiro!
pg_dump $DATABASE_URL > backup.sql

# Fazer rollback
npm run migrate:down

# Se necessário, restaurar backup
psql $DATABASE_URL < backup.sql
```

## 📈 Performance

O sistema é otimizado para:
- **Execução rápida** com transações
- **Verificação eficiente** de migrations pendentes
- **Logs detalhados** para debugging
- **Rollbacks seguros** com validação

As migrations são executadas em **ordem sequencial** e cada uma em sua própria **transação**, garantindo consistência.