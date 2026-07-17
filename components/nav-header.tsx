"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions";
import { button } from "@/lib/ui";

const LINKS = [
  { href: "/sessions/new", label: "New session" },
  { href: "/", label: "Logbook" },
  { href: "/insights2", label: "Insights" },
  { href: "/marks", label: "Marks" },
  { href: "/maintenance", label: "Maintenance" },
];

type NavUser = { email?: string | null; name?: string | null } | null;

export function NavHeader({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-10 border-b border-surface-border bg-surface/80 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 sm:px-6">
        <Link
          href={user ? "/account" : "/login"}
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          onClick={() => setMenuOpen(false)}
        >
          <Image src="/spearfisher-logo.png" alt="" width={35} height={22} className="dark:invert" />
          SpearLog
        </Link>

        {user && (
          <div className="hidden gap-1 text-sm sm:flex">
            {LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    active
                      ? "border-b-2 border-accent px-3 py-1.5 font-medium text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      : "border-b-2 border-transparent px-3 py-1.5 text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  }
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-muted lg:inline">{user.name || user.email}</span>
              <form action={logoutAction} className="hidden sm:block">
                <button type="submit" className={button("ghost", "text-xs")}>
                  Log out
                </button>
              </form>
              <button
                type="button"
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-md p-1.5 text-foreground hover:bg-surface-border/40 sm:hidden"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </>
          ) : (
            <Link href="/login" className="text-muted hover:text-foreground">
              Log in
            </Link>
          )}
        </div>
      </nav>

      {user && menuOpen && (
        <div className="flex flex-col gap-1 border-t border-surface-border px-4 py-3 text-sm sm:hidden">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={
                  active
                    ? "border-l-2 border-accent px-3 py-2 font-medium text-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    : "border-l-2 border-transparent px-3 py-2 text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                }
              >
                {link.label}
              </Link>
            );
          })}
          <div className="mt-1 flex items-center justify-between border-t border-surface-border px-3 pt-3">
            <span className="text-xs text-muted">{user.name || user.email}</span>
            <form action={logoutAction}>
              <button type="submit" className={button("ghost", "text-xs")}>
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
