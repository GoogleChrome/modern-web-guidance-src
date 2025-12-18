import lancedb from "@lancedb/lancedb";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory for LanceDB
const DATA_DIR = path.resolve(__dirname, "../../.mcp-data");

export interface UseCase {
  id: string;
  description: string;
  category: string;
  vector?: number[];
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

  public async search(queryVector: number[], limit = 5): Promise<UseCase[]> {
    const table = await this.getTable();
    if (!table) {
      return [];
    }

    const results = await table.vectorSearch(queryVector)
      .limit(limit)
      .toArray();

    return results.map((r: any) => ({
      id: r.id,
      description: r.description,
      category: r.category,
    }));
  }
}
