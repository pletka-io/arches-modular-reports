// The classic (Knockout) report of a resource: reportBase is arches.urls.resource_report ("/report/").
export function classicReportUrl(
    reportBase: string,
    resourceInstanceId: string,
): string {
    return `${reportBase}${resourceInstanceId}?view=classic`;
}
