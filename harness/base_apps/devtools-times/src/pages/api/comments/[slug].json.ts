import type { APIRoute } from 'astro';
import { db, eq, desc, Comments } from 'astro:db';

export const OPTIONS: APIRoute = async ({ request }) => {
    const response = new Response(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export const GET: APIRoute = async ({ params, request }) => {
    const { slug } = params;
    const responseHeaders = { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    if (!slug) {
        return new Response(JSON.stringify({ error: 'Slug is required' }), { status: 400, headers: responseHeaders });
    }

    try {
        const comments = await db.select().from(Comments).where(eq(Comments.slug, slug)).orderBy(desc(Comments.createdAt));
        return new Response(JSON.stringify(comments), { status: 200, headers: responseHeaders });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Database error' }), { status: 500, headers: responseHeaders });
    }
};

export const POST: APIRoute = async ({ params, request }) => {
    const { slug } = params;
    const responseHeaders = { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    try {
        const { author, body } = await request.json();
        if (!author || !body) {
            return new Response(JSON.stringify({ error: 'Author and content are required' }), { status: 400, headers: responseHeaders });
        }

        const result = await db.insert(Comments).values({
            slug,
            author,
            body,
            createdAt: new Date(),
        }).returning();

        return new Response(JSON.stringify(result[0]), { status: 201, headers: responseHeaders });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Failed to post comment' }), { status: 500, headers: responseHeaders });
    }
};