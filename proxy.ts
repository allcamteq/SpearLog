export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!login|signup|privacy|terms|forgot-password|reset-password|api/auth|api/signup|api/password-reset|_next/static|_next/image|favicon.ico|ocean-pattern.png|spearfisher-logo.png).*)",
  ],
};
