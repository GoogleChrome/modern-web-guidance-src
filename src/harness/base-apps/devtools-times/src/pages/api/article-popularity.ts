
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
    const id = url.searchParams.get('id');

    if (!id) {
        return new Response(JSON.stringify({
            error: "Invalid Request",
            message: "Missing required parameter: id"
        }), {
            status: 400,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }

    // Dummy data for success case
    return new Response(JSON.stringify({
        id: id,
        views: Math.floor(Math.random() * 10000),
        trending: true
    }), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}
