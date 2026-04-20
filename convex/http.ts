import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Mount @convex-dev/auth HTTP routes (token exchange, session management)
auth.addHttpRoutes(http);

export default http;
