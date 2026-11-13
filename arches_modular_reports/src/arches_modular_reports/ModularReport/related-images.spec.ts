import { describe, expect, it } from "vitest";
import { toImages } from "@/arches_modular_reports/ModularReport/related-images.ts";

const row = (name: string, link: string, url?: string) => ({
    "@display_name": { display_value: name, links: [{ label: name, link }] },
    image: {
        display_value: "",
        links: url ? [{ is_file: true, url, altText: "" }] : [],
    },
});

describe("toImages", () => {
    it("maps a row to report link, thumbnail, full image and caption", () => {
        expect(
            toImages([row("DSC_0284", "/report/r1", "/files/f1")], "image"),
        ).toEqual([
            {
                href: "/report/r1",
                thumb: "/files/f1?thumbnail=true",
                full: "/files/f1",
                caption: "DSC_0284",
            },
        ]);
    });
    it("toImages skips rows without a file link", () => {
        expect(
            toImages(
                [row("a", "/report/r1"), row("b", "/report/r2", "/files/f2")],
                "image",
            ).map((i) => i.caption),
        ).toEqual(["b"]);
    });
    it("keeps the server's order (sorted by sort_field there)", () => {
        const rows = [
            row("2", "/r/2", "/files/2"),
            row("1", "/r/1", "/files/1"),
        ];
        expect(toImages(rows, "image").map((i) => i.caption)).toEqual([
            "2",
            "1",
        ]);
    });
    it("an empty page gives no images", () => {
        expect(toImages([], "image")).toEqual([]);
    });
});
