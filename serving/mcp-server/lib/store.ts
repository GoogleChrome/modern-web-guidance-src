import lancedb from "@lancedb/lancedb";
import path from "path";
import fs from "fs";

// Data directory for LanceDB
const DATA_DIR = path.resolve(import.meta.dirname, "../../.modern-web-data");

export interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  chunkContent?: string;
  vector?: number[];
  distance?: number;
}

export class Store {
  private dbUrl: string;

  constructor() {
    this.dbUrl = DATA_DIR;
    // Ensure data directory exists
    if (!fs.existsSync(this.dbUrl)) {
      fs.mkdirSync(this.dbUrl, { recursive: true });
    }
  }

  private async getTable() {
    const db = await lancedb.connect(this.dbUrl);
    try {
      return await db.openTable("use_cases");
    } catch {
      return null;
    }
  }

  public async upsert(data: UseCase[]) {
    const db = await lancedb.connect(this.dbUrl);

    // Check if table exists
    const tableNames = await db.tableNames();
    if (tableNames.includes("use_cases")) {
      await db.dropTable("use_cases");
    }

    await db.createTable("use_cases", data as any);
  }

  public async search(queryVector: number[], limit = 5, maxDistance = 1.5): Promise<UseCase[]> {
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
    const uniqueResults: UseCase[] = [];

    for (const r of results) {
      const dist = r._distance;
      if (dist === undefined || dist > maxDistance) continue;

      if (seenIds.has(r.id)) continue;

      seenIds.add(r.id);
      uniqueResults.push({
        id: r.id as string,
        description: r.description as string,
        category: r.category as string,
        featuresUsed: Array.from(r.featuresUsed as Iterable<string>),
        distance: dist.toFixed(2),
      });

      if (uniqueResults.length >= limit) break;
    }

    return uniqueResults;
  }
}
