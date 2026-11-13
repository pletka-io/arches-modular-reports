<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useGettext } from "vue3-gettext";
import Paginator from "primevue/paginator";
import { fetchRelatedResourceData } from "@/arches_modular_reports/ModularReport/api.ts";
import { toImages } from "@/arches_modular_reports/ModularReport/related-images.ts";
import type { RelatedImage } from "@/arches_modular_reports/ModularReport/related-images.ts";
import type { RelatedImagesConfig } from "@/arches_modular_reports/ModularReport/types.ts";

const props = defineProps<{
    component: { config: RelatedImagesConfig };
    resourceInstanceId: string;
}>();
const { $gettext } = useGettext();
const cfg = computed(() => props.component.config);
const images = ref<RelatedImage[]>([]);
const total = ref(0);
const first = ref(0);
const failed = ref(new Set<string>());
const error = ref(false);

async function load(page: number) {
    try {
        const data = await fetchRelatedResourceData(
            props.resourceInstanceId,
            cfg.value.graph_slug,
            [cfg.value.image_node_alias],
            cfg.value.rows_per_page,
            page,
            cfg.value.sort_field,
            "asc",
            "",
        );
        images.value = toImages(data.results, cfg.value.image_node_alias);
        total.value = data.total_count;
    } catch {
        error.value = true;
    }
}

function onPage(e: { page: number; first: number }) {
    first.value = e.first;
    load(e.page + 1);
}

onMounted(() => load(1));
</script>

<template>
    <section
        v-if="total > 0 || error"
        class="related-images"
    >
        <p v-if="error">
            {{ $gettext("An error occurred while fetching data.") }}
        </p>
        <div
            v-else
            class="related-images-grid"
        >
            <a
                v-for="img in images"
                :key="img.href"
                :href="img.href"
                class="related-images-item"
            >
                <img
                    v-if="!failed.has(img.thumb)"
                    :src="img.thumb"
                    :alt="img.caption"
                    loading="lazy"
                    @error="failed.add(img.thumb)"
                />
                <span
                    v-else
                    class="related-images-placeholder"
                    aria-hidden="true"
                ></span>
                <span class="related-images-caption">{{ img.caption }}</span>
            </a>
        </div>
        <Paginator
            v-if="total > cfg.rows_per_page"
            :rows="cfg.rows_per_page"
            :total-records="total"
            :first="first"
            @page="onPage"
        />
    </section>
</template>

<style scoped>
.related-images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.75rem;
}
.related-images-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-decoration: none;
}
.related-images-item img,
.related-images-placeholder {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    background: var(--p-content-border-color, #ddd);
}
.related-images-caption {
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
