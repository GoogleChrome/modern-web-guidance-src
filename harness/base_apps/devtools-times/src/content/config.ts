import { defineCollection, z } from 'astro:content';

const articlesCollection = defineCollection({
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
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.string(),
    category: z.string(),
  }),
});

const multimediaCollection = defineCollection({
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
