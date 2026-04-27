
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.session) {
    // Initialize the reading list if it doesn't exist
    const readingList = await context.session.get('readingList');
    if (readingList === undefined) {
      await context.session.set('readingList', []);
    }
  }
  return next();
});
