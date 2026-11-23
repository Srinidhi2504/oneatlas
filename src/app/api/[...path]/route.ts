// Catch-all for unknown /api/* paths: answers with the JSON error envelope instead of the HTML 404 page.
import { fail } from "@/server/http";

// Unknown /api/* paths answer with the JSON error envelope (docs/05) instead of the HTML 404 page.
// Real routes are more specific, so they always win over this catch-all.
const notFound = () => fail(404, "NOT_FOUND", "Unknown API endpoint. See /api/v1 routes in the README.");
export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
