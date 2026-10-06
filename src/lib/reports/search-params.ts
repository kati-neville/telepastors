import {
  reportFilterSchema,
  type ReportFilterValues,
} from "@/lib/validations/reports";

export function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseReportSearchParams(
  params: Record<string, string | string[] | undefined>,
): ReportFilterValues {
  return reportFilterSchema.parse({
    campaignId: getSearchParam(params, "campaignId"),
    governorId: getSearchParam(params, "governorId"),
    leaderId: getSearchParam(params, "leaderId"),
    telepastorId: getSearchParam(params, "telepastorId"),
    response: getSearchParam(params, "response"),
    from: getSearchParam(params, "from"),
    to: getSearchParam(params, "to"),
    view: getSearchParam(params, "view"),
    hasNotes:
      getSearchParam(params, "hasNotes") === "true" ? "true" : undefined,
  });
}
