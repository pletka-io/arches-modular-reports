<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from "vue";
import { useGettext } from "vue3-gettext";

import Button from "primevue/button";
import Column from "primevue/column";
import DataTable from "primevue/datatable";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Dialog from "primevue/dialog";

import {
    ASC,
    DESC,
    ROWS_PER_PAGE_OPTIONS,
} from "@/arches_modular_reports/constants.ts";
import {
    fetchModularReportTile,
    fetchNodegroupTileData,
} from "@/arches_modular_reports/ModularReport/api.ts";
import FileListViewer from "@/arches_modular_reports/ModularReport/components/FileListViewer.vue";
import HierarchicalTileViewer from "@/arches_modular_reports/ModularReport/components/HierarchicalTileViewer.vue";

import type { Ref } from "vue";
import type { DataTablePageEvent } from "primevue/datatable";
import type {
    LabelBasedCard,
    NodeData,
    NodePresentationLookup,
    LanguageSettings,
    TileData,
} from "@/arches_modular_reports/ModularReport/types";

import {
    formatNumber,
    tileHasPopulatedChildren,
    tileIsPopulated,
} from "@/arches_modular_reports/ModularReport/utils.ts";

const props = defineProps<{
    component: {
        config: {
            nodegroup_alias: string;
            node_aliases: string[];
            custom_labels: Record<string, string>;
            custom_card_name: string | null;
            has_write_permission: boolean;
            filters:
                | { alias: string; value: string; field_lookup: string }[]
                | null;
            expanded_by_default?: boolean;
            auto_expand_if_populated?: boolean;
            inline_children?: boolean;
        };
    };
    resourceInstanceId: string;
}>();

const { requestCreateTile } = inject("createTile") as {
    requestCreateTile: (nodegroupAlias: string) => void;
};

const { requestSoftDeleteTile } = inject("softDeleteTile") as {
    requestSoftDeleteTile: (nodegroupAlias: string, tileId: string) => void;
};

const { $gettext } = useGettext();
const CARDINALITY_N = "n";
const queryTimeoutValue = 500;
let timeout: ReturnType<typeof setTimeout> | null = null;

const rowsPerPage = ref(ROWS_PER_PAGE_OPTIONS[0]);
const currentPage = ref(1);
const query = ref("");
const sortNodeId = ref("");
const direction = ref(ASC);
const currentlyDisplayedTableData = ref<unknown[]>([]);
const searchResultsTotalCount = ref(0);
const isLoading = ref(false);
const hasLoadingError = ref(false);
const resettingToFirstPage = ref(false);
const pageNumberToNodegroupTileData = ref<Record<number, unknown[]>>({});
const expandedRows = ref<LabelBasedCard[]>([]);
const inlineChildrenText = ref<Record<string, string>>({});
const displayDialog = ref(false);
const selectedRichText = ref<{ header: string; data: string } | null>(null);

const showRichTextDialog = (header: string, data: string) => {
    selectedRichText.value = { header, data };
    displayDialog.value = true;
};

const userCanEditResourceInstance = inject(
    "userCanEditResourceInstance",
) as Ref<boolean>;
const nodePresentationLookup = inject("nodePresentationLookup") as Ref<
    NodePresentationLookup | undefined
>;
const hideEmptyFields = inject("hideEmptyFields") as Ref<boolean>;
const recursiveHideEmpty = inject(
    "recursiveHideEmpty",
    ref(false),
) as Ref<boolean>;
const graphSlug = inject<string>("graphSlug")!;
const languageSettings = inject(
    "languageSettings",
    ref({ ACTIVE_LANGUAGE: "en", ACTIVE_LANGUAGE_DIRECTION: "ltr" }),
) as Ref<LanguageSettings>;
const { setSelectedNodegroupAlias } = inject("selectedNodegroupAlias") as {
    setSelectedNodegroupAlias: (nodegroupAlias: string | undefined) => void;
};
const { setSelectedTileId } = inject("selectedTileId") as {
    setSelectedTileId: (tileId: string | null | undefined) => void;
};
const { setSelectedTilePath } = inject("selectedTilePath") as {
    setSelectedTilePath: (path: string[] | null) => void;
};
const { setSelectedNodeAlias } = inject("selectedNodeAlias") as {
    setSelectedNodeAlias: (nodeAlias: string | null) => void;
};
const { setShouldShowEditor } = inject("shouldShowEditor") as {
    setShouldShowEditor: (shouldShow: boolean) => void;
};

const first = computed(() => {
    if (resettingToFirstPage.value) {
        return 0;
    }
    return (currentPage.value - 1) * rowsPerPage.value;
});

const isEmpty = computed(
    () => !isLoading.value && !query.value && !searchResultsTotalCount.value,
);

const shouldShowSection = computed(
    () => !(hideEmptyFields?.value && isEmpty.value),
);

const showEmptyChildNodes = computed(
    () => !(hideEmptyFields?.value && recursiveHideEmpty.value),
);

const isInlineChildrenMode = computed(
    () => props.component.config.inline_children ?? false,
);

const shouldShowAddButton = computed(
    () =>
        userCanEditResourceInstance.value &&
        props.component.config.has_write_permission &&
        (isEmpty.value || cardinality.value === CARDINALITY_N),
);

const columnData = computed(() => {
    if (!nodePresentationLookup.value) {
        return [];
    }
    return props.component.config.node_aliases.map((nodeAlias) => {
        const nodeDetails = nodePresentationLookup.value![nodeAlias];
        return {
            nodeAlias: nodeAlias,
            widgetLabel:
                props.component.config.custom_labels?.[nodeAlias] ??
                nodeDetails?.widget_label ??
                nodeAlias,
            is_rich_text: nodeDetails?.is_rich_text,
            is_numeric: nodeDetails?.is_numeric,
            number_format: nodeDetails?.number_format,
        };
    });
});

// With "hide empty fields" on, drop columns that hold no value in any row of
// the current page. Only affects the read-only table; the editor still
// offers every node of the nodegroup.
function cellHasValue(cell: unknown): boolean {
    if (!cell || typeof cell !== "object") {
        return false;
    }
    const nodeData = cell as {
        display_value?: unknown;
        is_file?: boolean;
        file_data?: unknown[];
    };
    if (nodeData.is_file) {
        return Boolean(nodeData.file_data?.length);
    }
    const value = nodeData.display_value;
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    return value != null && String(value).trim() !== "";
}

const visibleColumnData = computed(() => {
    const rows = currentlyDisplayedTableData.value as Record<string, unknown>[];
    if (!hideEmptyFields?.value || rows.length === 0) {
        return columnData.value;
    }
    const populated = columnData.value.filter((column) =>
        rows.some((row) => cellHasValue(row[column.nodeAlias])),
    );
    // Rows with no readable value at all (e.g. anonymous viewers): keep the
    // headers rather than render a table with zero columns.
    return populated.length ? populated : columnData.value;
});

const cardinality = computed(() => {
    const firstNodeAlias = props.component.config.node_aliases[0];
    if (!nodePresentationLookup.value || !firstNodeAlias) {
        return "";
    }
    return nodePresentationLookup.value[firstNodeAlias].nodegroup.cardinality;
});

const cardName = computed(() => {
    const firstNodeAlias = props.component.config.node_aliases[0];
    if (!nodePresentationLookup.value || !firstNodeAlias) {
        return "";
    }
    return (
        props.component.config.custom_card_name ??
        nodePresentationLookup.value[firstNodeAlias].card_name
    );
});

watch(query, () => {
    if (timeout) {
        clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
        pageNumberToNodegroupTileData.value = {};
        resettingToFirstPage.value = true;
        fetchData(1);
    }, queryTimeoutValue);
});

watch([direction, sortNodeId, rowsPerPage], () => {
    pageNumberToNodegroupTileData.value = {};
    resettingToFirstPage.value = true;
    fetchData(1);
});

watch(currentPage, () => {
    if (currentPage.value in pageNumberToNodegroupTileData.value) {
        currentlyDisplayedTableData.value =
            pageNumberToNodegroupTileData.value[currentPage.value];
    } else {
        resettingToFirstPage.value = false;
        fetchData(currentPage.value);
    }
});

watch(currentlyDisplayedTableData, (rows) => {
    applyDefaultExpansion(rows as LabelBasedCard[]);
    loadInlineChildrenText(rows as LabelBasedCard[]);
});

onMounted(fetchData);

function isTileOrTileArray(input: unknown): boolean {
    return Boolean(
        (input as TileData)?.tileid ||
            (Array.isArray(input) && input.every((item) => item.tileid)),
    );
}

function childTilesOf(tile: TileData): TileData[] {
    if (!nodePresentationLookup.value) {
        return [];
    }
    return Object.entries(tile.aliased_data).reduce(
        (acc, [nodeAlias, nodeValue]) => {
            if (
                isTileOrTileArray(nodeValue) &&
                nodePresentationLookup.value![nodeAlias]?.visible
            ) {
                const childTiles = (
                    Array.isArray(nodeValue) ? nodeValue : [nodeValue]
                ) as TileData[];
                acc.push(...childTiles);
            }
            return acc;
        },
        [] as TileData[],
    );
}

function inlineChildTileLabel(nodeAlias: string) {
    return (
        props.component.config.custom_labels?.[nodeAlias] ??
        nodePresentationLookup.value?.[nodeAlias]?.widget_label ??
        nodeAlias
    );
}

function inlineChildTileText(tile: TileData): string {
    if (!nodePresentationLookup.value) {
        return "";
    }
    return Object.entries(tile.aliased_data)
        .filter(([nodeAlias, nodeValue]) => {
            return (
                !isTileOrTileArray(nodeValue) &&
                (nodeValue as NodeData | null)?.node_value != null &&
                nodePresentationLookup.value![nodeAlias]?.visible
            );
        })
        .map(([nodeAlias, nodeValue]) => {
            return `${inlineChildTileLabel(nodeAlias)}: ${
                (nodeValue as NodeData).display_value
            }`;
        })
        .join(", ");
}

function buildInlineChildrenText(tile: TileData): string {
    return childTilesOf(tile)
        .filter(tileIsPopulated)
        .map(inlineChildTileText)
        .filter((text) => text.length > 0)
        .join("; ");
}

async function loadInlineChildrenText(rows: LabelBasedCard[]) {
    if (!isInlineChildrenMode.value) {
        return;
    }

    const rowsToFetch = rows.filter(
        (row) =>
            row["@has_children"] === true &&
            !(row["@tile_id"] in inlineChildrenText.value),
    );

    await Promise.all(
        rowsToFetch.map(async (row) => {
            const tileId = row["@tile_id"];
            try {
                const tile = (await fetchModularReportTile(
                    graphSlug,
                    props.component.config.nodegroup_alias,
                    tileId,
                )) as TileData;
                inlineChildrenText.value = {
                    ...inlineChildrenText.value,
                    [tileId]: buildInlineChildrenText(tile),
                };
            } catch {
                inlineChildrenText.value = {
                    ...inlineChildrenText.value,
                    [tileId]: "",
                };
            }
        }),
    );
}

async function applyDefaultExpansion(rows: LabelBasedCard[]) {
    if (isInlineChildrenMode.value) {
        return;
    }

    const expandedByDefault =
        props.component.config.expanded_by_default ?? false;
    const autoExpandIfPopulated =
        props.component.config.auto_expand_if_populated ?? false;
    if (!expandedByDefault && !autoExpandIfPopulated) {
        return;
    }

    const rowsWithChildren = rows.filter(
        (row) => row["@has_children"] === true,
    );
    if (expandedByDefault) {
        expandedRows.value = rowsWithChildren;
        return;
    }

    const populatedRows = await Promise.all(
        rowsWithChildren.map(async (row) => {
            try {
                const tile = (await fetchModularReportTile(
                    graphSlug,
                    props.component.config.nodegroup_alias,
                    row["@tile_id"],
                )) as TileData;
                return tileHasPopulatedChildren(tile) ? row : null;
            } catch {
                return null;
            }
        }),
    );
    if (rows !== currentlyDisplayedTableData.value) {
        return;
    }
    expandedRows.value = populatedRows.filter(
        (row): row is LabelBasedCard => row !== null,
    );
}

async function fetchData(page: number = 1) {
    isLoading.value = true;

    try {
        const {
            results,
            page: fetchedPage,
            total_count: totalCount,
        } = await fetchNodegroupTileData(
            props.resourceInstanceId,
            props.component.config.nodegroup_alias,
            rowsPerPage.value,
            page,
            sortNodeId.value,
            direction.value,
            query.value,
            props.component.config?.filters,
        );

        pageNumberToNodegroupTileData.value[fetchedPage] = results;
        currentlyDisplayedTableData.value = results;
        currentPage.value = fetchedPage;
        searchResultsTotalCount.value = totalCount;
    } catch (error) {
        hasLoadingError.value = true;
        throw error;
    } finally {
        isLoading.value = false;
    }
}

function onPageTurn(event: DataTablePageEvent) {
    currentPage.value = resettingToFirstPage.value ? 1 : event.page + 1;
    rowsPerPage.value = event.rows;
}

function onUpdateSortField(event: string) {
    sortNodeId.value = nodePresentationLookup.value![event].nodeid;
}

function onUpdateSortOrder(event: number | undefined) {
    if (event === 1) {
        direction.value = ASC;
    } else if (event === -1) {
        direction.value = DESC;
    }
}

function rowClass(data: LabelBasedCard) {
    return [{ "no-children": data["@has_children"] === false }];
}

function initiateEdit(tileId: string | null) {
    setSelectedNodegroupAlias(props.component.config.nodegroup_alias);
    setSelectedNodeAlias(props.component.config.node_aliases[0]);

    // We cannot derive the path from the tileid alone, so clear it.
    setSelectedTilePath(null);
    setSelectedTileId(tileId);

    if (!tileId) {
        requestCreateTile(props.component.config.nodegroup_alias);
    }

    setShouldShowEditor(true);
}

function initiateSoftDelete(tileId: string) {
    initiateEdit(tileId);
    requestSoftDeleteTile(props.component.config.nodegroup_alias, tileId);
}
</script>

<template>
    <Message
        v-if="hasLoadingError"
        size="large"
        severity="error"
        icon="pi pi-times-circle"
    >
        {{ $gettext("An error occurred while fetching data.") }}
    </Message>

    <template v-else-if="isEmpty && !shouldShowSection">
        <!-- Hidden: empty section with hide toggle enabled -->
    </template>

    <div
        v-else-if="isEmpty"
        class="section-table"
    >
        <div class="p-datatable-header section-table-header">
            <h4>{{ cardName }}</h4>
            <Button
                v-if="shouldShowAddButton"
                :label="$gettext('Add %{cardName}', { cardName })"
                icon="pi pi-plus"
                variant="outlined"
                @click="initiateEdit(null)"
            />
        </div>
        <div class="no-data-found">
            {{ $gettext("No data found.") }}
        </div>
    </div>

    <DataTable
        v-else
        v-model:expanded-rows="expandedRows"
        class="section-table"
        :value="currentlyDisplayedTableData"
        :loading="isLoading"
        :total-records="searchResultsTotalCount"
        :first="first"
        :row-class="rowClass"
        :always-show-paginator="
            searchResultsTotalCount >
            Math.min(rowsPerPage, ROWS_PER_PAGE_OPTIONS[0])
        "
        :lazy="true"
        :rows="rowsPerPage"
        :rows-per-page-options="ROWS_PER_PAGE_OPTIONS"
        :sortable="cardinality === CARDINALITY_N"
        paginator
        @page="onPageTurn"
        @update:first="resettingToFirstPage = false"
        @update:sort-field="onUpdateSortField"
        @update:sort-order="onUpdateSortOrder"
    >
        <template #header>
            <div class="section-table-header">
                <h4>{{ cardName }}</h4>
                <Button
                    v-if="shouldShowAddButton"
                    :label="$gettext('Add %{cardName}', { cardName })"
                    icon="pi pi-plus"
                    variant="outlined"
                    @click="initiateEdit(null)"
                />

                <div class="section-table-header-functions">
                    <IconField v-if="cardinality === CARDINALITY_N">
                        <InputIcon
                            class="pi pi-search"
                            aria-hidden="true"
                            style="font-size: 1rem"
                        />
                        <InputText
                            v-model="query"
                            :placeholder="$gettext('Search')"
                            :aria-label="$gettext('Search')"
                        />
                    </IconField>
                </div>
            </div>
        </template>
        <template #empty>
            <Message
                size="large"
                severity="info"
                icon="pi pi-info-circle"
            >
                {{ $gettext("No results match your search.") }}
            </Message>
        </template>

        <Column
            v-if="!isInlineChildrenMode"
            expander
            class="expander-column"
        />
        <Column
            v-for="columnDatum of visibleColumnData"
            :key="columnDatum.nodeAlias"
            :field="columnDatum.nodeAlias"
            :header="columnDatum.widgetLabel"
            :sortable="cardinality === CARDINALITY_N"
        >
            <template #body="{ data, field }">
                <div
                    :style="{
                        maxHeight: data[field as string]?.file_data
                            ? '32rem'
                            : '12rem',
                        overflow: 'auto',
                    }"
                >
                    <template v-if="data[field as string]?.has_links">
                        <Button
                            v-for="item in data[field as string].display_value"
                            :key="item.link"
                            :href="item.link"
                            target="_blank"
                            as="a"
                            variant="link"
                            :label="item.label"
                            style="display: block; width: fit-content"
                        />
                    </template>
                    <FileListViewer
                        v-else-if="data[field as string]?.is_file"
                        :file-data="data[field as string].file_data"
                    />
                    <template v-else-if="columnDatum.is_rich_text">
                        <span
                            class="rich-text-container"
                            @click="
                                showRichTextDialog(
                                    columnDatum.widgetLabel,
                                    data[field as string]?.display_value,
                                )
                            "
                            v-html="data[field as string]?.display_value"
                        ></span>
                    </template>
                    <template v-else-if="columnDatum.is_numeric">
                        {{
                            formatNumber(
                                data[field as string]?.display_value,
                                columnDatum.number_format,
                                languageSettings,
                            )
                        }}
                    </template>
                    <template v-else>
                        {{ data[field as string]?.display_value }}
                    </template>
                </div>
            </template>
        </Column>
        <Column
            v-if="isInlineChildrenMode"
            :header="$gettext('Details')"
            class="inline-children-column"
        >
            <template #body="{ data }">
                {{ inlineChildrenText[data["@tile_id"]] ?? "" }}
            </template>
        </Column>
        <Column
            v-if="
                userCanEditResourceInstance &&
                props.component.config.has_write_permission
            "
            class="edit-button-column"
        >
            <template #body="{ data }">
                <div
                    style="
                        width: 100%;
                        display: flex;
                        justify-content: flex-end;
                    "
                >
                    <div
                        style="
                            display: flex;
                            justify-content: space-evenly;
                            width: 6rem;
                        "
                    >
                        <Button
                            icon="pi pi-pencil"
                            class="p-button-outlined"
                            :aria-label="$gettext('Edit')"
                            rounded
                            @click="initiateEdit(data['@tile_id'])"
                        />
                        <Button
                            icon="pi pi-trash"
                            class="p-button-outlined"
                            severity="danger"
                            :aria-label="$gettext('Delete')"
                            rounded
                            @click="initiateSoftDelete(data['@tile_id'])"
                        />
                    </div>
                </div>
            </template>
        </Column>
        <template
            v-if="!isInlineChildrenMode"
            #expansion="slotProps"
        >
            <HierarchicalTileViewer
                :nodegroup-alias="props.component.config.nodegroup_alias"
                :tile-id="slotProps.data['@tile_id']"
                :custom-labels="props.component.config.custom_labels"
                :show-empty-nodes="showEmptyChildNodes"
            />
        </template>
    </DataTable>
    <Dialog
        v-model:visible="displayDialog"
        :modal="true"
        :header="selectedRichText?.header"
        :style="{ width: '50vw' }"
        :breakpoints="{ '1199px': '75vw', '575px': '90vw' }"
    >
        <span
            class="rich-text-container"
            v-html="selectedRichText?.data"
        ></span>
    </Dialog>
</template>

<style scoped>
:deep(.p-datatable-table) {
    table-layout: fixed;
}

.panel-content .section-table:not(:first-child) {
    padding-top: 18px;
}

.section-table-header {
    display: flex;
    align-items: center;
}

.section-table-header h4 {
    font-size: 1.8rem;
}

.section-table-header button {
    margin: 0 20px;
    padding: 3px 8px;
}

.section-table-header-functions {
    display: flex;
    justify-content: flex-end;
    flex-grow: 1;
}

:deep(.expander-column) {
    width: 3rem;
}

:deep(.edit-button-column) {
    width: 8rem;
}

.no-data-found {
    padding: var(--p-datatable-body-cell-padding);
    border-color: var(--p-datatable-body-cell-border-color);
    border-style: solid;
    border-width: 0px 0 1px 0;
}

.rich-text-container {
    overflow-wrap: anywhere;
    cursor: pointer;
}

:deep(.rich-text-container > p) {
    margin: unset !important;
}

:deep(.p-datatable-column-sorted) {
    background: var(--p-datatable-header-cell-background);
}

:deep(.no-children .p-datatable-row-toggle-button) {
    visibility: hidden;
}

:deep(.p-paginator) {
    justify-content: end;
}

.p-button-link {
    padding: 0;
}

@media print {
    .section-table-header-functions {
        display: none;
    }
}
</style>
