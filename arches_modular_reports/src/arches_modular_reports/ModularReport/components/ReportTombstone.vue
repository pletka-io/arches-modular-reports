<script setup lang="ts">
import arches from "arches";
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { useGettext } from "vue3-gettext";

import Message from "primevue/message";
import Panel from "primevue/panel";

import {
    fetchNodeGeoJSON,
    fetchNodeTileData,
} from "@/arches_modular_reports/ModularReport/api.ts";
import { RESOURCE_LIMIT_FOR_HEADER } from "@/arches_modular_reports/constants.ts";
import LabeledNodeValues from "@/arches_modular_reports/ModularReport/components/LabeledNodeValues.vue";
import { createGeometryMap } from "@/arches_modular_reports/ModularReport/utils/geometry-map.ts";

// mapbox-gl css ships globally via arches core arches.scss

import type { FeatureCollection } from "geojson";
import type { GeometryMap } from "@/arches_modular_reports/ModularReport/utils/geometry-map.ts";
import type { Ref } from "vue";
import type {
    NodePresentationLookup,
    NodeValueDisplayDataLookup,
    ReportTombstoneConfig,
    SectionContent,
} from "@/arches_modular_reports/ModularReport/types";

const resourceInstanceId = inject("resourceInstanceId") as string;

const props = defineProps<{
    component: SectionContent;
}>();

const config = props.component.config as ReportTombstoneConfig;

const nodePresentationLookup = inject("nodePresentationLookup") as Ref<
    NodePresentationLookup | undefined
>;
const { $gettext } = useGettext();

const isLoading = ref(true);
const hasLoadingError = ref(false);
const displayDataByAlias: Ref<NodeValueDisplayDataLookup | null> = ref(null);

interface ImageTileData {
    display_values: string[];
    links: { is_file: boolean; altText: string; url: string }[];
}

const imageNodeData = ref<Record<string, ImageTileData[]> | null>(null);
const fallbackImage = ref<{
    url: string;
    altText: string;
    parentReportUrl: string;
} | null>(null);
const mapFeatureCollection: Ref<FeatureCollection | null> = ref(null);
const mapContainerElement = ref<HTMLDivElement | null>(null);

let map: GeometryMap | null = null;

const UUID_PATTERN =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const firstImageTileData = computed(() => {
    if (!config.image_node_alias) {
        return undefined;
    }
    return imageNodeData.value?.[config.image_node_alias]?.[0];
});

const imageUrl = computed(() => {
    if (isLoading.value) {
        return "";
    }
    if (firstImageTileData.value?.links?.[0]?.url) {
        return firstImageTileData.value.links[0].url;
    }
    if (fallbackImage.value) {
        return fallbackImage.value.url;
    }
    return arches.urls.media + "img/photo_missing.png";
});

const imageAltText = computed(() => {
    if (isLoading.value) {
        return "";
    }
    if (firstImageTileData.value?.links?.[0]) {
        return firstImageTileData.value.links[0].altText;
    }
    if (fallbackImage.value?.altText) {
        return fallbackImage.value.altText;
    }
    return $gettext("Image not available");
});

function bestWidgetLabel(nodeAlias: string) {
    return (
        config.custom_labels?.[nodeAlias] ??
        nodePresentationLookup.value?.[nodeAlias].widget_label ??
        nodeAlias
    );
}

async function fetchMapData() {
    if (!config.map_node_alias) {
        return;
    }
    try {
        const geoJSONByAlias = await fetchNodeGeoJSON(resourceInstanceId, [
            config.map_node_alias,
        ]);
        const featureCollection = geoJSONByAlias[
            config.map_node_alias
        ] as FeatureCollection | null;
        if (featureCollection?.features?.length) {
            mapFeatureCollection.value = featureCollection;
        }
    } catch {
        // The map is auxiliary: if geometry cannot be fetched, show no map.
    }
}

async function fetchFallbackImage() {
    if (
        !config.image_node_alias ||
        !config.image_fallback_relation_alias ||
        firstImageTileData.value?.links?.[0]?.url
    ) {
        return;
    }
    try {
        const relationData = await fetchNodeTileData(
            resourceInstanceId,
            [config.image_fallback_relation_alias],
            1,
        );
        const relationLink =
            relationData[config.image_fallback_relation_alias]?.[0]?.links?.[0];
        const parentResourceId = relationLink?.link?.match(UUID_PATTERN)?.[0];
        if (!parentResourceId) {
            return;
        }
        const parentImageData = await fetchNodeTileData(
            parentResourceId,
            [config.image_node_alias],
            1,
        );
        const parentImageLink = (
            parentImageData[config.image_node_alias]?.[0] as
                | ImageTileData
                | undefined
        )?.links?.[0];
        if (!parentImageLink?.url) {
            return;
        }
        fallbackImage.value = {
            url: parentImageLink.url,
            altText: parentImageLink.altText,
            parentReportUrl: relationLink.link,
        };
    } catch {
        // The fallback image is best-effort: on failure keep the placeholder.
    }
}

async function fetchData() {
    isLoading.value = true;
    try {
        displayDataByAlias.value = await fetchNodeTileData(
            resourceInstanceId,
            config.node_aliases,
            RESOURCE_LIMIT_FOR_HEADER,
        );
        if (config.image_node_alias) {
            imageNodeData.value = await fetchNodeTileData(
                resourceInstanceId,
                [config.image_node_alias],
                1,
            );
        }
        hasLoadingError.value = false;
    } catch {
        hasLoadingError.value = true;
    } finally {
        isLoading.value = false;
    }
    await Promise.all([fetchMapData(), fetchFallbackImage()]);
}

watch(
    [mapFeatureCollection, mapContainerElement],
    ([featureCollection, container]) => {
        if (featureCollection && container && !map) {
            map = createGeometryMap(container, featureCollection, {
                interactive: false,
            });
        }
    },
);

onMounted(fetchData);

onUnmounted(() => {
    map?.remove();
    map = null;
});
</script>

<template>
    <Panel style="border: 0; border-radius: 0">
        <div
            v-if="imageNodeData || mapFeatureCollection"
            class="media-container"
        >
            <div
                v-if="imageNodeData"
                class="image-container"
            >
                <img
                    :src="imageUrl"
                    :alt="imageAltText"
                />
                <a
                    v-if="fallbackImage"
                    class="fallback-image-caption"
                    :href="fallbackImage.parentReportUrl"
                >
                    {{ $gettext("Image from parent record") }}
                </a>
            </div>
            <div
                v-if="mapFeatureCollection"
                ref="mapContainerElement"
                class="map-container"
            ></div>
        </div>
        <div class="data-container">
            <Message
                v-if="hasLoadingError"
                severity="error"
                style="height: 3rem; width: fit-content"
            >
                {{ $gettext("Unable to fetch resource") }}
            </Message>
            <template v-else-if="displayDataByAlias">
                <LabeledNodeValues
                    v-for="nodeAlias in config.node_aliases"
                    :key="nodeAlias"
                    :node-alias="nodeAlias"
                    :widget-label="bestWidgetLabel(nodeAlias)"
                    :display-data="displayDataByAlias[nodeAlias]"
                />
            </template>
        </div>
    </Panel>
</template>

<style scoped>
:deep(.p-panel-header) {
    padding-top: 6px;
    padding-bottom: 6px;
}

:deep(.p-panel-content) {
    display: flex;
    justify-content: space-between;
    width: 100%;
    gap: 1rem;
}

.data-container {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 2rem;
    margin: 0 4.5rem 3rem;
}

.media-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 18rem;
}

.map-container {
    width: 18rem;
    height: 12rem;
}

.fallback-image-caption {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.85rem;
}

img {
    width: 100%;
    height: auto;
    object-fit: contain;
    align-self: start;
}

@media print {
    .data-container {
        grid-template-columns: unset;
        padding: 2rem;
    }
}
</style>
