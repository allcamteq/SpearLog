export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!login|signup|privacy|terms|api/auth|api/signup|_next/static|_next/image|favicon.ico|ocean-pattern.png|spearfisher-logo.png).*)",
  ],
};
