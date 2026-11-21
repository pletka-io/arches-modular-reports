import { describe, expect, it } from "vitest";
import { classicReportUrl } from "./classic-report-url.ts";

describe("classicReportUrl", () => {
    it("is the report page with view=classic", () => {
        expect(classicReportUrl("/report/", "1d2b")).toBe(
            "/report/1d2b?view=classic",
        );
    });

    it("keeps a path prefix", () => {
        expect(classicReportUrl("/arches/report/", "1d2b")).toBe(
            "/arches/report/1d2b?view=classic",
        );
    });
});
