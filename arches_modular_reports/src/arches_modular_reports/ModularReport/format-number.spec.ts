import { describe, expect, it } from "vitest";
import { formatNumber } from "./utils.ts";

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
