<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";
import { useGettext } from "vue3-gettext";

import Message from "primevue/message";

import { fetchNodeGeoJSON } from "@/arches_modular_reports/ModularReport/api.ts";
import { createGeometryMap } from "@/arches_modular_reports/ModularReport/utils/geometry-map.ts";

// mapbox-gl css ships globally via arches core arches.scss

import type { FeatureCollection } from "geojson";
import type { Ref } from "vue";
import type {
    MapSectionConfig,
    NodePresentationLookup,
    SectionContent,
} from "@/arches_modular_reports/ModularReport/types";
import type { GeometryMap } from "@/arches_modular_reports/ModularReport/utils/geometry-map.ts";

const props = defineProps<{
    component: SectionContent;
}>();

const config = props.component.config as MapSectionConfig;

const resourceInstanceId = inject("resourceInstanceId") as string;
const nodePresentationLookup = inject("nodePresentationLookup") as Ref<
    NodePresentationLookup | undefined
>;
const hideEmptyFields = inject("hideEmptyFields", ref(false)) as Ref<boolean>;
const { $gettext } = useGettext();

const isLoading = ref(true);
const hasLoadingError = ref(false);
const featureCollection: Ref<FeatureCollection | null> = ref(null);
const mapContainerElement = ref<HTMLDivElement | null>(null);
let map: GeometryMap | null = null;

const cardName = computed(
    () =>
        config.custom_card_name ??
        nodePresentationLookup.value?.[config.node_alias]?.card_name ??
        $gettext("Map"),
);

const isEmpty = computed(
    () => !isLoading.value && !featureCollection.value?.features?.length,
);

const shouldShowSection = computed(
    () => !(hideEmptyFields.value && isEmpty.value),
);

async function fetchData() {
    isLoading.value = true;
    try {
        const geoJSONByAlias = await fetchNodeGeoJSON(resourceInstanceId, [
            config.node_alias,
        ]);
        featureCollection.value = (geoJSONByAlias[config.node_alias] ??
            null) as FeatureCollection | null;
        hasLoadingError.value = false;
    } catch {
        hasLoadingError.value = true;
    } finally {
        isLoading.value = false;
    }
}

watch([featureCollection, mapContainerElement], ([collection, container]) => {
    if (collection?.features?.length && container && !map) {
        map = createGeometryMap(container, collection, { interactive: true });
    }
});

onMounted(fetchData);

onUnmounted(() => {
    map?.remove();
    map = null;
});
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

    <template v-else-if="!shouldShowSection">
        <!-- Hidden: no geometry with hide toggle enabled -->
    </template>

    <div
        v-else
        class="section-table map-section"
    >
        <div class="p-datatable-header section-table-header">
            <h4>{{ cardName }}</h4>
        </div>
        <Message
            v-if="isEmpty"
            size="large"
            severity="info"
            icon="pi pi-info-circle"
        >
            {{ $gettext("No location recorded.") }}
        </Message>
        <div
            v-else
            ref="mapContainerElement"
            class="map-container"
            :style="{ height: config.height ?? '28rem' }"
        ></div>
    </div>
</template>

<style scoped>
.map-section {
    margin-bottom: 1rem;
}

.section-table-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
}

.section-table-header h4 {
    margin: 0;
    font-size: 1.6rem;
}

.map-container {
    width: 100%;
    border: 1px solid var(--p-datatable-border-color, #e2e8f0);
}

@media print {
    .map-container {
        height: 20rem;
    }
}
</style>
