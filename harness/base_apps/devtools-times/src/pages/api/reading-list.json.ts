
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, session }) => {
  const { slug } = await request.json();
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Slug is required' }), { status: 400 });
  }

  let readingList = await session?.get('readingList') || [];

  if (readingList.includes(slug)) {
    readingList = readingList.filter((item: string) => item !== slug);
  } else {
    readingList.push(slug);
  }

  await session?.set('readingList', readingList);

  return new Response(JSON.stringify({ readingList }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ session }) => {
  const readingList = await session?.get('readingList') || [];

  return new Response(JSON.stringify({ readingList }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
