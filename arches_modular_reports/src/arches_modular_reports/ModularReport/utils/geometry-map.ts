import mapboxgl from "mapbox-gl";

import type { FeatureCollection, Position } from "geojson";

// Minimal typing for the untyped mapbox-gl (v1) module resolved
// from arches core dependencies.
export interface GeometryMap {
    on(event: string, handler: () => void): void;
    addSource(sourceId: string, source: unknown): void;
    addLayer(layer: unknown): void;
    addControl(control: unknown, position?: string): void;
    remove(): void;
}

const GEOMETRY_COLOR = "#2d6a9f";

const OSM_RASTER_STYLE = {
    version: 8,
    sources: {
        osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxzoom: 19,
        },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function collectPositions(coordinates: unknown, positions: Position[]) {
    if (!Array.isArray(coordinates)) {
        return;
    }
    if (typeof coordinates[0] === "number") {
        positions.push(coordinates as Position);
        return;
    }
    for (const nested of coordinates) {
        collectPositions(nested, positions);
    }
}

export function computeBounds(featureCollection: FeatureCollection) {
    const positions: Position[] = [];
    for (const feature of featureCollection.features) {
        if (!feature.geometry) {
            continue;
        }
        if (feature.geometry.type === "GeometryCollection") {
            for (const geometry of feature.geometry.geometries) {
                if ("coordinates" in geometry) {
                    collectPositions(geometry.coordinates, positions);
                }
            }
        } else {
            collectPositions(feature.geometry.coordinates, positions);
        }
    }
    if (!positions.length) {
        return null;
    }
    const longitudes = positions.map((position) => position[0]);
    const latitudes = positions.map((position) => position[1]);
    return [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
    ];
}

/**
 * Render a feature collection on an OSM raster map fitted to its bounds.
 * Returns null when the collection has no positions to fit.
 */
export function createGeometryMap(
    container: HTMLDivElement,
    featureCollection: FeatureCollection,
    options: { interactive: boolean },
): GeometryMap | null {
    const bounds = computeBounds(featureCollection);
    if (!bounds) {
        return null;
    }
    const map: GeometryMap = new mapboxgl.Map({
        container,
        style: OSM_RASTER_STYLE,
        interactive: options.interactive,
        attributionControl: true,
        bounds,
        fitBoundsOptions: { padding: 24, maxZoom: 15 },
    });
    if (options.interactive) {
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
    }
    map.on("load", () => {
        map.addSource("geometry", {
            type: "geojson",
            data: featureCollection,
        });
        map.addLayer({
            id: "geometry-fill",
            type: "fill",
            source: "geometry",
            filter: ["==", "$type", "Polygon"],
            paint: {
                "fill-color": GEOMETRY_COLOR,
                "fill-opacity": 0.2,
            },
        });
        map.addLayer({
            id: "geometry-line",
            type: "line",
            source: "geometry",
            filter: ["!=", "$type", "Point"],
            paint: {
                "line-color": GEOMETRY_COLOR,
                "line-width": 2,
            },
        });
        map.addLayer({
            id: "geometry-point",
            type: "circle",
            source: "geometry",
            filter: ["==", "$type", "Point"],
            paint: {
                "circle-color": GEOMETRY_COLOR,
                "circle-radius": 6,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1.5,
            },
        });
    });
    return map;
}
