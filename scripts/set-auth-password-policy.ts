import "dotenv/config";

const MINIMUM_PASSWORD_LENGTH = 4;

async function main() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!accessToken || !supabaseUrl) {
    console.error(
      "Set SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL in .env.local.",
    );
    console.error(
      "Create a token at https://supabase.com/dashboard/account/tokens",
    );
    process.exit(1);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        minimum_password_length: MINIMUM_PASSWORD_LENGTH,
        password_requirements: "",
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to update auth config (${response.status}): ${body}`,
    );
  }

  console.log(
    `Updated Supabase auth minimum password length to ${MINIMUM_PASSWORD_LENGTH}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
