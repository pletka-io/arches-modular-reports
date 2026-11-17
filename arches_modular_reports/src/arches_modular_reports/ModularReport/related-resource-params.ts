export const relatedResourceParams = (
    nodeAliases: string[],
    rowsPerPage: number,
    page: number,
    sortField: string,
    direction: string,
    query: string,
    natural = false,
    reverseLabels: Record<string, string> = {},
) => {
    const params = new URLSearchParams({
        node_aliases: nodeAliases.join(","),
        rows_per_page: rowsPerPage.toString(),
        page: page.toString(),
        sort_field: sortField,
        direction,
        query,
    });
    // Order sort_field by (length, value): unpadded numbers sort 1, 2, 10.
    if (natural) params.set("natural", "true");
    // Incoming relations show these labels instead of the node's widget label.
    if (Object.keys(reverseLabels).length)
        params.set("reverse_labels", JSON.stringify(reverseLabels));
    return params;
};
