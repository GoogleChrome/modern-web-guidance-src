
import { defineDb, defineTable, column } from 'astro:db';

export const Comments = defineTable({
  columns: {
    id: column.number({ primaryKey: true }),
    slug: column.text(),
    author: column.text(),
    body: column.text(),
    createdAt: column.date(),
  }
});

export default defineDb({
  tables: { Comments }
});
