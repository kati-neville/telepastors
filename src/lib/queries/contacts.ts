import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { createClient } from "@/lib/supabase/server";
import { buildContactSearchFilter } from "@/lib/utils/search";
import type { Contact, ContactImportSummary, ContactWithAssignee, MinistryRole } from "@/types/domain";
import type { ContactsFilterValues } from "@/lib/validations/campaigns";

export type CampaignContactsResult = {
  contacts: ContactWithAssignee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function enrichContactsWithAssignees(
  contacts: Contact[],
): Promise<ContactWithAssignee[]> {
  const supabase = await createClient();
  const assigneeIds = [
    ...new Set(
      contacts
        .map((contact) => contact.current_assignee_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: assignees } = assigneeIds.length
    ? await supabase
        .from("telepastors")
        .select("id, name, role")
        .in("id", assigneeIds)
    : { data: [] };

  const assigneeMap = new Map(
    (assignees ?? []).map((assignee) => [
      assignee.id,
      { name: assignee.name, role: assignee.role as MinistryRole },
    ]),
  );

  return contacts.map((contact) => {
    const assignee = contact.current_assignee_id
      ? assigneeMap.get(contact.current_assignee_id)
      : null;

    return {
      ...contact,
      assignee_name: assignee?.name ?? null,
      assignee_role: assignee?.role ?? null,
    };
  });
}

export async function fetchExistingNormalizedPhones(
  campaignId: string,
): Promise<Set<string>> {
  const supabase = await createClient();

  const phones = await fetchAllPages<{ phone_normalized: string }>(
    async (from, to) =>
      supabase
        .from("contacts")
        .select("phone_normalized")
        .eq("campaign_id", campaignId)
        .range(from, to),
  );

  return new Set(phones.map((row) => row.phone_normalized));
}

export async function fetchCampaignContacts(
  campaignId: string,
  filters: ContactsFilterValues,
): Promise<CampaignContactsResult> {
  const supabase = await createClient();
  const page = filters.page;
  const pageSize = filters.pageSize;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("contacts")
    .select("*", { count: "exact" })
    .eq("campaign_id", campaignId)
    .order("name", { ascending: true })
    .range(from, to);

  const search = filters.q?.trim();
  if (search) {
    const filter = buildContactSearchFilter(search);
    if (filter) {
      query = query.or(filter);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    contacts: await enrichContactsWithAssignees(data ?? []),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function fetchContactImports(
  campaignId: string,
): Promise<ContactImportSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_imports")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const imports = data ?? [];
  const importerIds = [
    ...new Set(
      imports
        .map((item) => item.imported_by)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const { data: importers } = importerIds.length
    ? await supabase.from("telepastors").select("id, name").in("id", importerIds)
    : { data: [] };

  const importerMap = new Map(
    (importers ?? []).map((importer) => [importer.id, importer.name]),
  );

  return imports.map((item) => ({
    ...item,
    imported_by_name: item.imported_by
      ? (importerMap.get(item.imported_by) ?? null)
      : null,
  }));
}

export async function fetchContactImportById(importId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
