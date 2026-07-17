import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
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

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

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
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="mt-1 text-sm text-muted">Welcome back to SpearLog.</p>
        </div>
        <form action={loginAction} className={`${cardClass} flex flex-col gap-4 p-5`}>
          {error && <p className="text-sm text-danger">Invalid email or password.</p>}
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" name="email" required autoFocus className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <input type="password" name="password" required className={inputClass} />
          </div>
          <button type="submit" className={button("primary")}>
            Log in
          </button>
        </form>
        <p className="text-sm text-muted">
          Don&rsquo;t have an account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
