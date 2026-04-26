import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/broker(.*)",
  "/merchant(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/docusign/callback",
  "/api/broker/portal-select",
  "/api/broker/email-select",
  "/api/plaid/create-link-token",
  "/api/plaid/exchange-token",
  "/api/persona/create-inquiry",
  "/api/persona/complete-inquiry",
  "/api/docusign/create-envelope",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
