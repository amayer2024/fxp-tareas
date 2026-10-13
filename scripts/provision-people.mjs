import { createClient } from "@supabase/supabase-js";

/**
 * Provision accounts on hosted Supabase. Usage:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/provision-people.mjs < people.json
 *
 * people.json is a JSON array of
 * { email, password, full_name, title, role, spaces[] }
 * where spaces are slugs. Never commit that file.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const raw = await new Promise((resolve, reject) => {
  const chunks = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  process.stdin.on("error", reject);
});

const people = JSON.parse(raw);
if (!Array.isArray(people) || people.length === 0) {
  console.error("stdin tiene que ser una lista JSON de personas.");
  process.exit(1);
}

const supabase = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: spaces, error: spacesError } = await supabase
  .from("spaces")
  .select("id, slug");
if (spacesError) throw spacesError;
const spaceBySlug = new Map(spaces.map((s) => [s.slug, s.id]));

for (const person of people) {
  const email = String(person.email).trim().toLowerCase();
  const password = String(person.password);
  const full_name = String(person.full_name).trim();
  const role = person.role === "admin" ? "admin" : "staff";
  const title = person.title ? String(person.title) : null;
  const slugs = Array.isArray(person.spaces) ? person.spaces.map(String) : [];

  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  let userId = created?.user?.id;
  if (createError) {
    if (!/already been registered|already exists/i.test(createError.message)) {
      throw new Error(`${email}: ${createError.message}`);
    }
    const { data: list, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;
    userId = list.users.find((u) => u.email === email)?.id;
    if (!userId) throw new Error(`${email}: existe pero no se encontró el id`);
    const { error: passError } = await supabase.auth.admin.updateUserById(
      userId,
      { password, email_confirm: true, user_metadata: { full_name } },
    );
    if (passError) throw new Error(`${email}: ${passError.message}`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name, title, role, active: true })
    .eq("id", userId);
  if (profileError) throw new Error(`${email} profile: ${profileError.message}`);

  const rows = slugs
    .map((slug) => {
      const space_id = spaceBySlug.get(slug);
      if (!space_id) throw new Error(`espacio desconocido: ${slug}`);
      return { space_id, user_id: userId };
    })
    .filter(Boolean);

  if (rows.length) {
    const { error: memberError } = await supabase
      .from("space_members")
      .upsert(rows, { onConflict: "space_id,user_id" });
    if (memberError) throw new Error(`${email} spaces: ${memberError.message}`);
  }

  console.log(`ok ${email} (${role})`);
}
