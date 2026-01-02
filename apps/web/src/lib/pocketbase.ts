import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://localhost:8090';

export const Collections = {
  users: 'users',
  subscriptions: 'subscriptions',
  tasks: 'tasks',
  usage_records: 'usage_records',
} as const;

export function createServerPocketBase(): PocketBase {
  return new PocketBase(POCKETBASE_URL);
}

export function createClientPocketBase(): PocketBase {
  return new PocketBase(POCKETBASE_URL);
}
