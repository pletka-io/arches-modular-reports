import { describe, expect, it } from "vitest";
import {
    formatNumber,
    tileHasPopulatedChildren,
    tileIsPopulated,
    truncateDisplayData,
    uniqueId,
} from "./utils.ts";

const lang = { ACTIVE_LANGUAGE: "en" } as never;
const fmt = (format: string | null, precision?: number | string | null) =>
    ({ format, precision, prefix: {}, suffix: {} }) as never;

describe("formatNumber", () => {
    it("keeps decimals when the widget sets no format", () => {
        expect(formatNumber(2.678, fmt(""), lang)).toBe("2.678");
        expect(formatNumber(0.453, fmt(null), lang)).toBe("0.453");
        expect(formatNumber(18.75, fmt(""), lang)).toBe("18.75");
    });

    it("rounds to the widget precision when no format is set", () => {
        expect(formatNumber(2.678, fmt("", 2), lang)).toBe("2.68");
        expect(formatNumber(2.678, fmt(null, "1"), lang)).toBe("2.7");
    });

    it("uses an explicit format", () => {
        expect(formatNumber(1234.5, fmt("0,0.00", 1), lang)).toBe("1,234.50");
    });

    it("leaves an empty value blank", () => {
        expect(formatNumber("", fmt(""), lang)).toBe("");
        expect(formatNumber(null as never, fmt("0,0"), lang)).toBe("");
        expect(formatNumber(undefined as never, fmt(""), lang)).toBe("");
    });

    it("keeps prefix and suffix", () => {
        const f = { format: "", prefix: { en: "ca. " }, suffix: { en: " cm" } };
        expect(formatNumber(2.5, f as never, lang)).toBe("ca. 2.5 cm");
    });
});

const tile = (aliased_data: Record<string, unknown>) =>
    ({ tileid: "t", aliased_data }) as never;
const node = (node_value: unknown) => ({ node_value, display_value: "" });

describe("tileIsPopulated", () => {
    it("is true when a node has a value", () => {
        expect(tileIsPopulated(tile({ a: node(null), b: node(0) }))).toBe(true);
    });

    it("is false when every node is empty", () => {
        expect(tileIsPopulated(tile({ a: node(null), b: null }))).toBe(false);
    });

    it("looks into child tiles", () => {
        const child = tile({ c: node("x") });
        expect(tileIsPopulated(tile({ a: node(null), kids: [child] }))).toBe(
            true,
        );
    });
});

describe("tileHasPopulatedChildren", () => {
    it("ignores the tile's own nodes", () => {
        expect(tileHasPopulatedChildren(tile({ a: node("x") }))).toBe(false);
    });

    it("finds a populated child tile", () => {
        const child = tile({ c: node("x") });
        expect(tileHasPopulatedChildren(tile({ kid: child }))).toBe(true);
    });
});

describe("truncateDisplayData", () => {
    it("cuts the display values over the limit", () => {
        const data = [
            { display_values: ["a", "b"], links: ["1", "2"] },
            { display_values: ["c", "d"], links: ["3", "4"] },
        ] as never;
        expect(truncateDisplayData(data, 3)).toEqual([
            { display_values: ["a", "b"], links: ["1", "2"] },
            { display_values: ["c"], links: ["3"] },
        ]);
    });
});

describe("uniqueId", () => {
    it("is a whole number", () => {
        expect(Number.isInteger(uniqueId(null))).toBe(true);
    });
});
