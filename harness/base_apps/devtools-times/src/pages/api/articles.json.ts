
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, request }) => {
    const articles = await getCollection('articles');
    const formattedArticles = articles.map(article => ({
        slug: article.id,
        title: article.data.title,
        summary: article.data.summary,
        image: article.data.image,
    }));

    // Simulate a network delay to make the INP issue more noticeable
    return new Response(JSON.stringify(formattedArticles));
}
