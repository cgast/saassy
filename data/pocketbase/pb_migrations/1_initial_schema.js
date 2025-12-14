/// <reference path="../pb_data/types.d.ts" />

/**
 * Initial schema migration for Saassy
 * Creates the core collections: subscriptions, tasks, usage_records
 */

migrate((db) => {
  // ===========================================
  // Extend users collection
  // ===========================================
  const users = db.collection('users');

  // Add custom fields to users
  users.schema.addField(new SchemaField({
    name: 'stripe_customer_id',
    type: 'text',
    required: false,
  }));

  users.schema.addField(new SchemaField({
    name: 'api_key',
    type: 'text',
    required: false,
  }));

  // ===========================================
  // Subscriptions collection
  // ===========================================
  const subscriptions = new Collection({
    name: 'subscriptions',
    type: 'base',
    schema: [
      {
        name: 'user',
        type: 'relation',
        required: true,
        options: {
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
      },
      {
        name: 'plan',
        type: 'select',
        required: true,
        options: {
          values: ['free', 'starter', 'pro', 'enterprise'],
        },
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        options: {
          values: ['active', 'canceled', 'past_due', 'trialing'],
        },
      },
      {
        name: 'stripe_subscription_id',
        type: 'text',
        required: false,
      },
      {
        name: 'current_period_end',
        type: 'date',
        required: false,
      },
      {
        name: 'limits',
        type: 'json',
        required: false,
      },
    ],
    indexes: [
      'CREATE INDEX idx_subscriptions_user ON subscriptions (user)',
      'CREATE INDEX idx_subscriptions_status ON subscriptions (status)',
    ],
  });

  db.save(subscriptions);

  // ===========================================
  // Tasks collection
  // ===========================================
  const tasks = new Collection({
    name: 'tasks',
    type: 'base',
    schema: [
      {
        name: 'user',
        type: 'relation',
        required: true,
        options: {
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
      },
      {
        name: 'type',
        type: 'text',
        required: true,
      },
      {
        name: 'status',
        type: 'select',
        required: true,
        options: {
          values: ['pending', 'queued', 'running', 'completed', 'failed', 'canceled'],
        },
      },
      {
        name: 'input',
        type: 'json',
        required: true,
      },
      {
        name: 'output',
        type: 'json',
        required: false,
      },
      {
        name: 'error',
        type: 'text',
        required: false,
      },
      {
        name: 'worker_id',
        type: 'text',
        required: false,
      },
      {
        name: 'started_at',
        type: 'date',
        required: false,
      },
      {
        name: 'completed_at',
        type: 'date',
        required: false,
      },
      {
        name: 'resource_usage',
        type: 'json',
        required: false,
      },
    ],
    indexes: [
      'CREATE INDEX idx_tasks_user ON tasks (user)',
      'CREATE INDEX idx_tasks_status ON tasks (status)',
      'CREATE INDEX idx_tasks_type ON tasks (type)',
      'CREATE INDEX idx_tasks_created ON tasks (created DESC)',
    ],
  });

  db.save(tasks);

  // ===========================================
  // Usage Records collection
  // ===========================================
  const usageRecords = new Collection({
    name: 'usage_records',
    type: 'base',
    schema: [
      {
        name: 'user',
        type: 'relation',
        required: true,
        options: {
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
      },
      {
        name: 'task',
        type: 'relation',
        required: false,
        options: {
          collectionId: 'tasks',
          cascadeDelete: false,
          maxSelect: 1,
        },
      },
      {
        name: 'period',
        type: 'text',
        required: true,
      },
      {
        name: 'cpu_seconds',
        type: 'number',
        required: false,
        options: {
          min: 0,
        },
      },
      {
        name: 'memory_mb_seconds',
        type: 'number',
        required: false,
        options: {
          min: 0,
        },
      },
      {
        name: 'task_count',
        type: 'number',
        required: false,
        options: {
          min: 0,
        },
      },
      {
        name: 'cost_cents',
        type: 'number',
        required: false,
        options: {
          min: 0,
        },
      },
    ],
    indexes: [
      'CREATE INDEX idx_usage_user ON usage_records (user)',
      'CREATE INDEX idx_usage_period ON usage_records (period)',
      'CREATE UNIQUE INDEX idx_usage_user_period ON usage_records (user, period)',
    ],
  });

  db.save(usageRecords);

}, (db) => {
  // Rollback
  db.collection('usage_records').delete();
  db.collection('tasks').delete();
  db.collection('subscriptions').delete();
});
