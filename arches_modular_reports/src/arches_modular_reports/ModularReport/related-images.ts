export interface RelatedLink {
    label?: string;
    link?: string;
    is_file?: boolean;
    url?: string;
    altText?: string;
}
export interface RelatedRow {
    [alias: string]: { display_value: string; links: RelatedLink[] };
}
export interface RelatedImage {
    href: string;
    thumb: string;
    full: string;
    caption: string;
}

/** Rows of the related-resources endpoint → gallery items, in the server's order. */
export function toImages(
    results: RelatedRow[],
    imageAlias: string,
): RelatedImage[] {
    return results.flatMap((r) => {
        const file = r[imageAlias]?.links.find((l) => l.is_file && l.url);
        if (!file?.url) return [];
        const name = r["@display_name"];
        return [
            {
                href: name?.links[0]?.link ?? "",
                thumb: `${file.url}?thumbnail=true`,
                full: file.url,
                caption: name?.display_value ?? "",
            },
        ];
    });
}

/** The record's own image wins; else the first related image's file. */
export function pickHeaderImage(
    own: string | undefined,
    related: RelatedImage[],
): string | undefined {
    return own || related[0]?.full;
}

/** Node aliases to request: the server only sorts by an alias it was asked for. */
export function relatedImageAliases(
    imageAlias: string,
    sortField: string,
): string[] {
    return [...new Set([imageAlias, sortField])];
}
