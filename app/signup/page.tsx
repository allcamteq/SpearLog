"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FishShape, BubblesShape, WaveShape } from "@/components/decorative-shapes";
import { inputClass, labelClass, cardClass, button } from "@/lib/ui";

const FEATURE_HIGHLIGHTS = [
  {
    title: "Manage Your Fishing Marks",
    description: "Easily organise all your fishing locations, with simple import and export options.",
  },
  {
    title: "Track Every Fishing Session",
    description:
      "Record each session alongside detailed tide, current and weather data automatically retrieved from trusted data sources.",
  },
  {
    title: "Identify Your Best Fishing Conditions",
    description:
      "Analyse your historical results to uncover trends and understand the conditions that produce your most successful sessions.",
  },
  {
    title: "Build a Complete Fishing Logbook",
    description: "Keep a detailed record of every trip, including photos, notes, fishing marks, catches and conditions.",
  },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    setPending(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error && typeof data.error === "string" ? data.error : "Could not create that account.");
      return;
    }

    router.push("/login");
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 items-center gap-10 py-8 lg:grid-cols-2 lg:py-16">
      <div className="relative hidden overflow-hidden rounded-2xl bg-accent-soft p-10 lg:block">
        <FishShape className="absolute right-8 top-10 w-24 -rotate-6 text-accent/30" />
        <FishShape className="absolute bottom-24 left-6 w-16 rotate-12 scale-x-[-1] text-accent/25" />
        <BubblesShape className="absolute right-20 bottom-16 w-6 text-accent/30" />
        <WaveShape className="absolute inset-x-0 bottom-10 w-full text-accent/20" />
        <div className="relative">
          <div className="flex items-center gap-2 text-lg font-semibold tracking-tight text-accent-soft-foreground">
            <Image src="/spearfisher-logo.png" alt="" width={42} height={26} className="dark:invert" />
            SpearLog
          </div>
          <h1 className="mt-8 text-3xl font-semibold tracking-tight text-accent-soft-foreground">
            Log every dive.
            <br />
            Track every catch.
          </h1>
          <p className="mt-3 max-w-xs text-sm text-accent-soft-foreground/80">
            Sessions, tides, conditions, and catches — all in one place, built for spearfishing.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {FEATURE_HIGHLIGHTS.map((feature) => (
              <li key={feature.title}>
                <p className="text-sm font-semibold text-accent-soft-foreground">{feature.title}</p>
                <p className="mt-0.5 max-w-xs text-xs text-accent-soft-foreground/80">{feature.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Sign up</h2>
          <p className="mt-1 text-sm text-muted">Create your SpearLog account.</p>
        </div>
        <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4 p-5`}>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div>
            <label className={labelClass}>Name (optional)</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              required
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input
              type="password"
              required
              minLength={8}
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
          </div>
          <button type="submit" disabled={pending} className={button("primary")}>
            {pending ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
