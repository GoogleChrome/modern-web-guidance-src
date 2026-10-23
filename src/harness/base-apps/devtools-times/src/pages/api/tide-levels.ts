
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
    // Redirect to a non-existent version 2 API or some other path
    // This simulates an API that has moved or is redirecting traffic
    return new Response(null, {
        status: 302,
        statusText: "Found",
        headers: {
            "Location": "/api/tide-levels-v2"  // This endpoint might not even exist, causing a 404 next, effectively showing the 302 first.
        }
    });
}
