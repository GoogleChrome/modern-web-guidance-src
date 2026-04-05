import lancedb from "@lancedb/lancedb";
import path from "path";
import fs from "fs";

// Dev mode: ../vector_store (from serving/lib)
// Prod mode: ./vector_store (from dist/skills-cli/skills/modern-web-use-cases/vector_store)
let DATA_DIR = path.resolve(import.meta.dirname, "../vector_store");
if (!fs.existsSync(DATA_DIR) && fs.existsSync(path.resolve(import.meta.dirname, "./vector_store"))) {
  DATA_DIR = path.resolve(import.meta.dirname, "./vector_store");
}

export interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  chunkContent?: string;
  vector?: number[];
  distance?: string;
}

export interface WebFeature {
  id: string;
  name: string;
  description: string;
  vector?: number[];
  distance?: string;
}


export type StoreItem = UseCase | WebFeature;

export class Store {
  private dbUrl: string;
  private tableName: string;

  constructor(tableName: string) {
    this.dbUrl = DATA_DIR;
    this.tableName = tableName;
    // Ensure data directory exists
    if (!fs.existsSync(this.dbUrl)) {
      fs.mkdirSync(this.dbUrl, { recursive: true });
    }
  }

  private async getTable() {
    const db = await lancedb.connect(this.dbUrl);
    try {
      return await db.openTable(this.tableName);
    } catch {
      return null;
    }
  }

  public async upsert(data: StoreItem[]) {
    const db = await lancedb.connect(this.dbUrl);

    // Check if table exists
    const tableNames = await db.tableNames();
    if (tableNames.includes(this.tableName)) {
      await db.dropTable(this.tableName);
    }

    await db.createTable(this.tableName, data as any);
  }

  public async search(queryVector: number[], limit = 5, maxDistance = 1.5): Promise<StoreItem[]> {
    const table = await this.getTable();
    if (!table) {
      return [];
    }

    // Fetch more results than needed to allow for deduplication
    const fetchLimit = limit * 3;

    const results = await table.vectorSearch(queryVector)
      .limit(fetchLimit)
      .toArray();

    const seenIds = new Set<string>();
    const uniqueResults: StoreItem[] = [];

    for (const r of results) {
      const dist = r._distance;
      if (dist === undefined || dist > maxDistance) continue;

      if (seenIds.has(r.id)) continue;

      seenIds.add(r.id);

      const { vector, _distance, ...rest } = r;
      uniqueResults.push({
        ...rest,
        distance: dist.toFixed(2),
      } as StoreItem);

      if (uniqueResults.length >= limit) break;
    }

    return uniqueResults;
  }
}
