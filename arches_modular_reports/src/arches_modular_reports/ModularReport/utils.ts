import numeral from "numeral";

import { defineAsyncComponent, isRef } from "vue";
import type { Ref } from "vue";

import type {
    ComponentLookup,
    NamedSection,
    NodeData,
    NodeValueDisplayData,
    SectionContent,
    LanguageSettings,
    NumberFormat,
    TileData,
} from "@/arches_modular_reports/ModularReport/types";

export function uniqueId(_unused: unknown) {
    /* Not cryptographically secure, but good enough for Vue component keys. */
    return Math.floor(Math.random() * Date.now());
}

export async function importComponents(
    namedSections: NamedSection[],
    componentLookup: ComponentLookup,
): Promise<void> {
    namedSections.forEach((section: NamedSection) => {
        section.components.forEach((component: SectionContent) => {
            componentLookup[component.component] = {
                component: defineAsyncComponent(
                    () => import(`@/${component.component}.vue`),
                ),
                key: uniqueId(component),
            };
        });
    });
}

function isTileOrTileArray(input: unknown): boolean {
    return Boolean(
        (input as TileData)?.tileid ||
            (Array.isArray(input) && input.every((item) => item.tileid)),
    );
}

function asTileArray(input: unknown): TileData[] {
    return (Array.isArray(input) ? input : [input]) as TileData[];
}

export function tileIsPopulated(tile: TileData): boolean {
    return Object.values(tile.aliased_data).some((value) => {
        if (isTileOrTileArray(value)) {
            return asTileArray(value).some(tileIsPopulated);
        }
        return (value as NodeData | null)?.node_value != null;
    });
}

export function tileHasPopulatedChildren(tile: TileData): boolean {
    return Object.values(tile.aliased_data).some(
        (value) =>
            isTileOrTileArray(value) &&
            asTileArray(value).some(tileIsPopulated),
    );
}

export function truncateDisplayData(
    displayValues: NodeValueDisplayData[],
    limit: number,
) {
    // The tiles were already fetched with a limit, but we unpack
    // multiple display values for *-list datatypes, so truncate.
    let counter = 0;
    return displayValues.reduce((acc, tileData) => {
        counter += tileData.display_values.length;
        const excess = counter - limit;
        if (excess > 0) {
            acc.push({
                display_values: tileData.display_values.slice(0, -excess),
                links: tileData.links.slice(0, -excess),
            });
        } else {
            acc.push(tileData);
        }
        return acc;
    }, [] as NodeValueDisplayData[]);
}

export function formatNumber(
    value: string | number,
    numberFormat: NumberFormat,
    languageSettings: LanguageSettings | Ref<LanguageSettings>,
) {
    const language = isRef(languageSettings)
        ? (languageSettings.value as LanguageSettings).ACTIVE_LANGUAGE
        : languageSettings.ACTIVE_LANGUAGE;
    const prefix = numberFormat.prefix?.[language] ?? "";
    const suffix = numberFormat.suffix?.[language] ?? "";
    return `${prefix}${numeral(value).format(numberFormat.format)}${suffix}`;
}
