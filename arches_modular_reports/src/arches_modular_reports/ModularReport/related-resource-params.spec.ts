import { describe, expect, it } from "vitest";
import { relatedResourceParams } from "@/arches_modular_reports/ModularReport/related-resource-params.ts";

const params = (natural = false, reverseLabels = {}) =>
    relatedResourceParams(
        ["a", "b"],
        10,
        2,
        "@relation_name",
        "asc",
        "q",
        natural,
        reverseLabels,
    );

describe("relatedResourceParams", () => {
    it("sends the paging, sort and search fields", () => {
        expect(Object.fromEntries(params())).toEqual({
            node_aliases: "a,b",
            rows_per_page: "10",
            page: "2",
            sort_field: "@relation_name",
            direction: "asc",
            query: "q",
        });
    });

    it("sends natural only when set", () => {
        expect(params(true).get("natural")).toBe("true");
        expect(params(false).has("natural")).toBe(false);
    });

    it("sends the reverse labels as JSON, only when there are any", () => {
        const sent = params(false, { part_of_context: "Contains artefact" });
        expect(JSON.parse(sent.get("reverse_labels")!)).toEqual({
            part_of_context: "Contains artefact",
        });
        expect(params(false, {}).has("reverse_labels")).toBe(false);
    });
});
