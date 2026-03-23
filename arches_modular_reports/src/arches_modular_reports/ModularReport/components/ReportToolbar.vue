<script setup lang="ts">
import arches from "arches";
import { inject } from "vue";
import { useGettext } from "vue3-gettext";

import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import type { Ref } from "vue";

import type { SectionContent } from "@/arches_modular_reports/ModularReport/types";

const { $gettext } = useGettext();

const hideEmptyFields = inject("hideEmptyFields") as {
    hideEmptyFields: Ref<boolean>;
};

enum ExportFormat {
    JSON = "json",
    JSON_LD = "json-ld",
    CSV = "csv",
}

const { component, resourceInstanceId } = defineProps<{
    component: SectionContent;
    resourceInstanceId: string;
}>();

function exportData(exportFormat: ExportFormat) {
    let params;
    switch (exportFormat) {
        case ExportFormat.JSON_LD:
            window.open(
                arches.urls.api_resources(resourceInstanceId) +
                    "?format=json-ld",
                "_blank",
            );
            break;
        case ExportFormat.JSON:
            window.open(
                arches.urls.api_resources(resourceInstanceId) +
                    "?format=json&v=beta",
                "_blank",
            );
            break;
        case ExportFormat.CSV:
            params = new URLSearchParams({
                format: "tilecsv",
                total: "1",
                "term-filter": JSON.stringify([
                    {
                        inverted: false,
                        type: "string",
                        context: "",
                        context_label: "",
                        id: resourceInstanceId,
                        value: resourceInstanceId,
                        selected: true,
                    },
                ]),
            });

            window.open(
                arches.urls.export_results + "?" + params.toString(),
                "_blank",
            );
            break;
    }
}
</script>

<template>
    <div class="export-links">
        <div class="export-links-label">
            {{ $gettext("Export as:") }}
        </div>
        <Button
            v-for="exportFormat in component.config.export_formats"
            :key="exportFormat"
            :label="exportFormat"
            :aria-label="
                $gettext('Export as: %{exportFormat}', { exportFormat })
            "
            variant="link"
            @click="exportData(exportFormat)"
        >
        </Button>
    </div>
    <div class="hide-empty-toggle">
        <Checkbox
            v-model="hideEmptyFields.hideEmptyFields"
            input-id="hide-empty-fields"
            :binary="true"
        />
        <label
            for="hide-empty-fields"
            class="hide-empty-label"
        >
            {{ $gettext("Hide empty fields") }}
        </label>
    </div>
</template>

<style scoped>
.export-links {
    display: flex;
    justify-content: flex-end;
    padding-inline-end: 20px;
    background-color: var(--p-panel-background);
}
.export-links-label {
    padding: 10px;
    color: var(--p-text-color);
}
@media print {
    .export-links {
        display: none;
    }
}
.hide-empty-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 10px;
}

.hide-empty-label {
    color: var(--p-text-color);
    cursor: pointer;
}
</style>
