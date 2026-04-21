
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ request }) => {
    const cookieHeader = request.headers.get('cookie') || '';
    
    // Explicitly check for large cookies to simulate the server limit
    // 4KB is a common default limit for many servers (e.g. Nginx)
    // We strictly enforce it here for the contest scenario
    if (cookieHeader.length > 4000) {
        return new Response(null, {
            status: 431,
            statusText: "Request Header Fields Too Large"
        });
    }

    return new Response(JSON.stringify({
        species: "General Flora",
        carbon_offset: "High",
        status: "Thriving"
    }), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });
}
