import { createServerClient } from "@supabase/ssr";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import dotenv from "dotenv";
import ws from "ws";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const testEmail =
  process.env.TEST_LOGOUT_EMAIL ?? "superadmin@test.telepastors.local";
const testPassword = process.env.TEST_LOGOUT_PASSWORD ?? "password";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

type StoredCookie = {
  value: string;
};

async function main() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase env vars in .env.local");
  }

  const cookieJar = new Map<string, StoredCookie>();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return [...cookieJar.entries()].map(([name, cookie]) => ({
          name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          if (!value) {
            cookieJar.delete(name);
          } else {
            cookieJar.set(name, { value });
          }
        }
      },
    },
    realtime: {
      transport: ws as unknown as WebSocketLikeConstructor,
    },
  });

  const cookieHeader = () =>
    [...cookieJar.entries()]
      .map(([name, cookie]) => `${name}=${cookie.value}`)
      .join("; ");

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInError) {
    throw new Error(`Sign in failed: ${signInError.message}`);
  }

  assert(cookieJar.size > 0, "Expected auth cookies after sign in");

  const {
    data: { user: signedInUser },
  } = await supabase.auth.getUser();
  assert(signedInUser !== null, "Expected authenticated Supabase user before logout");

  const protectedBefore = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: cookieHeader() },
    redirect: "manual",
  });
  const protectedBeforeLocation = protectedBefore.headers.get("location");
  assert(
    protectedBeforeLocation?.includes("redirectTo=") !== true,
    `Expected authenticated middleware access, got redirect to ${protectedBeforeLocation ?? "none"}`,
  );

  const signOutResponse = await fetch(`${baseUrl}/auth/signout`, {
    method: "POST",
    headers: { Cookie: cookieHeader() },
    redirect: "manual",
  });

  assert(
    signOutResponse.status === 303 || signOutResponse.status === 302,
    `Expected sign-out redirect, got ${signOutResponse.status}`,
  );

  const setCookieHeaders = signOutResponse.headers.getSetCookie?.() ?? [];
  for (const header of setCookieHeaders) {
    const pair = header.split(";")[0];
    if (!pair) {
      continue;
    }

    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);

    if (!value) {
      cookieJar.delete(name);
    } else {
      cookieJar.set(name, { value });
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  assert(user === null, "Expected Supabase session to be cleared after sign out");

  const dashboardAfter = await fetch(`${baseUrl}/dashboard`, {
    headers: { Cookie: cookieHeader() },
    redirect: "manual",
  });
  assert(
    dashboardAfter.status === 307 || dashboardAfter.status === 302,
    `Expected unauthenticated redirect from dashboard, got ${dashboardAfter.status}`,
  );
  assert(
    dashboardAfter.headers.get("location")?.includes("/login") === true,
    `Expected redirect to login after logout, got ${dashboardAfter.headers.get("location") ?? "none"}`,
  );
  assert(
    dashboardAfter.headers.get("location")?.includes("profile_missing") !== true,
    "Expected auth session to be cleared after logout",
  );

  const loginAfter = await fetch(`${baseUrl}/login`, {
    headers: { Cookie: cookieHeader() },
    redirect: "manual",
  });
  assert(
    loginAfter.status === 200,
    `Expected login page after logout, got ${loginAfter.status}`,
  );

  console.log("Logout flow tests passed.");
  console.log(`- Authenticated app access: ${protectedBefore.status}`);
  console.log(`- Sign out redirect: ${signOutResponse.status}`);
  console.log(`- Dashboard after logout: ${dashboardAfter.status}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
