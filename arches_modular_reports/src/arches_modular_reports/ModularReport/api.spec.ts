import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("arches", () => ({
    default: { urls: { api_related_resources: () => "/related" } },
}));

import { fetchRelatedResourceData } from "@/arches_modular_reports/ModularReport/api.ts";

const requestedParams = async (reverseLabels?: Record<string, string>) => {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchRelatedResourceData(
        "r1",
        "artefact",
        [],
        10,
        1,
        "@relation_name",
        "asc",
        "",
        false,
        reverseLabels,
    );
    return new URLSearchParams(fetchMock.mock.calls[0][0].split("?")[1]);
};

describe("fetchRelatedResourceData reverse labels", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("sends the reverse labels as JSON", async () => {
        const params = await requestedParams({
            part_of_context: "Contains artefact",
        });
        expect(JSON.parse(params.get("reverse_labels")!)).toEqual({
            part_of_context: "Contains artefact",
        });
    });

    it("leaves the parameter out when there are none", async () => {
        expect((await requestedParams()).has("reverse_labels")).toBe(false);
        expect((await requestedParams({})).has("reverse_labels")).toBe(false);
    });
});
