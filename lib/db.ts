import Dexie, { type Table } from 'dexie';

export interface CachedMatter {
  matterId: string;
  organisationId: string;
  data: any;
  fetchedAt: number;
}

export interface CachedMattersList {
  fingerprint: string;
  data: any;
  fetchedAt: number;
}

export interface CachedDeadline {
  deadlineId: string;
  matterId: string;
  date: string;
  data: any;
}

export interface CachedStatistics {
  id: string; // orgId
  data: any;
  fetchedAt: number;
}

export interface CachedTemplate {
  templateId: string;
  data: any;
  fetchedAt: number;
}

export interface MetaEntry {
  key: string;
  value: string;
}

class OfflineDB extends Dexie {
  matters!: Table<CachedMatter>;
  mattersList!: Table<CachedMattersList>;
  deadlines!: Table<CachedDeadline>;
  statistics!: Table<CachedStatistics>;
  templates!: Table<CachedTemplate>;
  meta!: Table<MetaEntry>;

  constructor() {
    super('OfflineDB');
    this.version(1).stores({
      matters: '&matterId, organisationId, fetchedAt',
      mattersList: '&fingerprint, fetchedAt',
      deadlines: '&deadlineId, matterId, date',
      statistics: '&id',
      templates: '&templateId, fetchedAt',
      meta: '&key',
    });
  }
}

export const db = new OfflineDB();

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export async function pruneStaleCache() {
  const cutoff = Date.now() - SEVEN_DAYS;
  await db.mattersList.where('fetchedAt').below(cutoff).delete();
  await db.matters.where('fetchedAt').below(cutoff).delete();
  await db.templates.where('fetchedAt').below(cutoff).delete();
}
