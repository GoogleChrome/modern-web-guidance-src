
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
    // Simulate a server-side processing error
    return new Response(JSON.stringify({
        error: "Internal Server Error",
        message: "Coffee machine is currently broken. Please contact system administrator."
    }), {
        status: 500,
        statusText: "Internal Server Error",
        headers: {
            "Content-Type": "application/json"
        }
    });
}
