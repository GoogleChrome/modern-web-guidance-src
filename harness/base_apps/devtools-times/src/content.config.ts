import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articlesCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    author: z.string(),
    date: z.date(),
    category: z.string(),
    image: z.string(),
    image_caption: z.string().optional(),
    tags: z.array(z.string()).optional(),
    readingTime: z.number().optional(),
    prompt_comment: z.string().optional(),
  }),
});

const reportsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/reports' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.string(),
    category: z.string(),
  }),
});

const multimediaCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/multimedia' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.string(),
    category: z.string(),
  }),
});

export const collections = {
  'articles': articlesCollection,
  'reports': reportsCollection,
  'multimedia': multimediaCollection,
};
