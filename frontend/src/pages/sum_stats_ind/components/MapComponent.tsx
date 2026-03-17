import { anc_cmaps, data_cmaps, reg_cmaps } from "@/assets/colormaps";
import { mapping } from "@/pages/sum_stats_ind/static/mapping";
import { mappingToLong, variables } from "@/pages/sum_stats_ind/static/ssiStatic";
import { DataPoint } from "@/types/sum_stat_ind_datapoint";
import * as d3 from "d3";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import React, { useEffect, useRef } from "react";

interface JitteredDataPoint extends DataPoint {
  jitteredLat: number;
  jitteredLon: number;
}

interface MapComponentProps {
  data: DataPoint[];
  tree_lin: string[];
  var_1: string;
  ancs: string[];
  chroms: string[];
  regs: string[];
  map_data: boolean;
  map_data_rad: number;
  map_reg: boolean;
  map_reg_rad: number;
  map_pop: boolean;
  map_pop_rad: number;
  map_ind_rad: number;
  map_lat_jit: number;
  map_lon_jit: number;
}


// -------------------- Helpers --------------------
const toShortCol = (s: string) => mapping.toShort[s] ?? s;
const toLongCol = (k: string) => mapping.toLong[k] ?? k;
const asNum = (x: unknown) => (x === null || x === undefined ? NaN : +x);


const xmur3 = (str: string) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
};

const mulberry32 = (a: number) => {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gaussianFromRng = (rng: () => number, mean: number, stdDev: number): number => {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mean;
};

const applyDeterministicJitter = (
  d: DataPoint,
  latJit: number,
  lonJit: number
): { jitterLat: number; jitterLon: number } => {
  const stableKey = `${d.ind_phase}|${d.ind}|${d.lat}|${d.lon}`;
  const seed = xmur3(stableKey)();
  const rng = mulberry32(seed);

  return {
    jitterLat: d.lat + gaussianFromRng(rng, 0, latJit),
    jitterLon: d.lon + gaussianFromRng(rng, 0, lonJit),
  };
};

const keyFromCols =
  (colsShort: string[]) =>
    (d: DataPoint): string => {
      if (colsShort.length === 0) return "__all__";
      if (colsShort.length === 1) {
        const v = (d as any)[colsShort[0]];
        return v === null || v === undefined ? "" : String(v);
      }
      return colsShort
        .map((c) => {
          const v = (d as any)[c];
          return v === null || v === undefined ? "" : String(v);
        })
        .join("_");
    };

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const makeNormMap = (m: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) out[norm(k)] = v;
  return out;
};

const valueShortMaps = {
  anc: makeNormMap(mapping.values.anc.toShort),
  reg: makeNormMap(mapping.values.reg.toShort),
  chrom: makeNormMap(mapping.values.chrom.toShort),
} as const;

type ValueField = keyof typeof valueShortMaps;

const toShortValue = (field: ValueField, v: string) => {
  return valueShortMaps[field][norm(v)] ?? v;
};

function toLongValue(colKeyShort: string, v: unknown): string {
  if (v === null || v === undefined) return "NA";
  const s = String(v);
  const valueMapToLong =
    (mapping.values as any)[colKeyShort]?.toLong as
    | Record<string, string>
    | undefined;
  return valueMapToLong?.[s] ?? s;
}


// -------------------- Color scale --------------------
const createColorScale = (
  data: DataPoint[],
  col: string,
  var_1: string
): {
  getColor: (d: DataPoint) => string;
  legendData: { label: string; color: string; extent?: [number, number] }[];
  discreteOrContinuous: string;
  globalColorOrder: string[];
} => {
  let getColor: (d: DataPoint) => string;
  let legendData: { label: string; color: string; extent?: [number, number] }[];
  let discreteOrContinuous: string;
  let globalColorOrder: string[] = [];

  const var1Short = toShortCol(var_1);
  const continuousShortSet = new Set(variables.continousOptions.map(toShortCol));
  const discreteShortSet = new Set(variables.discreteOptions.map(toShortCol));

  const colShort = col ? [toShortCol(col)] : [];
  const colorKey = keyFromCols(colShort);
  let continuousColorFieldShort: string | null = null;


  if (col === "") {
    const defaultColor = "steelblue";
    getColor = () => defaultColor;
    legendData = [{ label: "Default Color", color: defaultColor }];
    discreteOrContinuous = "default";
    globalColorOrder = ["__all__"];
  } else {
    const groupedData = Array.from(
      d3.group(data, (d) => colorKey(d)),
      ([key, values]) => ({
        key,
        values,
        mean: d3.mean(values, (v) => (v as any)[var1Short] as number)!,
      })
    );

    const sortedGroups = groupedData.sort((a, b) =>
      d3.ascending(a.mean, b.mean)
    );

    globalColorOrder = sortedGroups.map((group) => group.key);

    if (continuousShortSet.has(colShort[0])) {
      const key = colShort[0];
      continuousColorFieldShort = key;

      const values = data
        .map((d) => Number((d as any)[key]))
        .filter(Number.isFinite);

      if (values.length === 0) {
        getColor = () => "steelblue";
        legendData = [{ label: "No valid data", color: "steelblue" }];
        discreteOrContinuous = "continuous";
        globalColorOrder = [];
      } else {
        const [rawMin, rawMax] = d3.extent(values) as [number, number];
        let min = Math.floor(rawMin);
        let max = Math.ceil(rawMax);
        if (min === max) { min -= 1; max += 1; }

        const extent: [number, number] = [min, max];
        const colorScale = d3.scaleSequential(d3.interpolateViridis).domain(extent);

        getColor = (d) => {
          const v = Number((d as any)[key]);
          return Number.isFinite(v) ? colorScale(v) : "steelblue";
        };

        legendData = [
          { label: `Min: ${min}`, color: colorScale(min), extent },
          { label: `Max: ${max}`, color: colorScale(max), extent },
        ];

        discreteOrContinuous = "continuous";
        globalColorOrder = [];
      }

      return {
        getColor,
        legendData,
        discreteOrContinuous,
        globalColorOrder,
      };
    }

    if (["reg", "dat", "anc"].includes(colShort[0])) {
      let chosenMap: Record<string, string> = {};
      if (colShort[0] === "reg") chosenMap = reg_cmaps;
      else if (colShort[0] === "dat") chosenMap = data_cmaps;
      else if (colShort[0] === "anc") chosenMap = anc_cmaps;

      getColor = (d) => {
        const val = colorKey(d);
        if (!val) return "steelblue";
        return chosenMap[val] || "steelblue";
      };


      legendData = globalColorOrder.map((val) => ({
        // if val is short-coded value, try mapping.values[col0Short].toLong
        label: toLongValue(colShort[0], val),
        color: chosenMap[val] || "steelblue",
      }));

      discreteOrContinuous = "discrete";
    } else {
      const colorScale = d3
        .scaleOrdinal<string, string>(d3.schemeCategory10)
        .domain(globalColorOrder);

      getColor = (d) => {
        const value = colorKey(d);
        return value !== null && value !== undefined && value !== ""
          ? colorScale(String(value))
          : "steelblue";
      };


      legendData = globalColorOrder.map((value) => ({
        label: String(value),
        color: colorScale(value),
      }));

      discreteOrContinuous = "discrete";
    }
  }
  return { getColor, legendData, discreteOrContinuous, globalColorOrder };
};



const MapComponent: React.FC<MapComponentProps> = ({
  data,
  tree_lin,
  var_1,
  ancs,
  chroms,
  regs,
  map_data,
  map_data_rad,
  map_reg,
  map_reg_rad,
  map_pop,
  map_pop_rad,
  map_ind_rad,
  map_lat_jit,
  map_lon_jit,
}) => {

  const tooltipContainerRef = useRef<HTMLDivElement>(null);
  const tooltipSelRef = useRef<d3.Selection<HTMLDivElement, unknown, null, undefined> | null>(null);
  const ancFields = ["ancAMR", "ancEAS", "ancSAS", "ancAFR", "ancEUR", "ancOCE"] as const;
  function filterOutNullAncestryFields(data: DataPoint[], var_1: string, col: string) {
    const var1Short = toShortCol(var_1);
    const colShort = col ? [toShortCol(col)] : [];

    const varIsAnc = ancFields.includes(var1Short as any);
    const colHasAnc = colShort.some((c) => ancFields.includes(c as any));

    if (!varIsAnc && !colHasAnc) return data;

    return data.filter((d) => {
      if (varIsAnc && (d as any)[var1Short] === null) return false;
      if (colHasAnc) {
        for (const c of colShort) {
          if (ancFields.includes(c as any) && (d as any)[c] === null) return false;
        }
      }
      return true;
    });
  }

  const excludeIndPhase = new Set(tree_lin ?? []);
  const ancAllowed = new Set((ancs ?? []).map((v) => toShortValue("anc", v)));
  const regAllowed = new Set((regs ?? []).map((v) => toShortValue("reg", v)));
  const chromAllowed = new Set((chroms ?? []).map((v) => toShortValue("chrom", v)));

  // --- Apply filters ---
  let filteredData = data.filter((d) => {
    if (excludeIndPhase.size > 0 && excludeIndPhase.has(d.ind_phase)) return false;
    if (ancAllowed.size > 0 && !ancAllowed.has(d.anc)) return false;
    if (regAllowed.size > 0 && !regAllowed.has(d.reg)) return false;

    const chromPass =
      chromAllowed.has(d.chrom) ||
      (chromAllowed.has("A") && (d.chrom === "A" || /^\d+$/.test(d.chrom)));
    if (!chromPass) return false;

    return true;
  });

  filteredData = filterOutNullAncestryFields(filteredData, var_1, var_1);
  data = filteredData;

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map>();

  const dataColorScale = (dat: string) => {
    return data_cmaps[dat as keyof typeof data_cmaps] || "#CCCCCC";
  };

  const regColorScale = (reg: string) => {
    return reg_cmaps[reg as keyof typeof reg_cmaps] || "#CCCCCC";
  };

  const popColorScale = d3
    .scaleOrdinal(d3.schemeSet2)
    .domain([...new Set(data.map((d) => d.pop))]);


  const generateGaussianNoise = (mean: number, stdDev: number): number => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) + mean;
  };

  const applyJitter = (
    lat: number,
    lon: number,
    latJit: number,
    lonJit: number
  ): { jitterLat: number; jitterLon: number } => ({
    jitterLat: lat + generateGaussianNoise(0, latJit),
    jitterLon: lon + generateGaussianNoise(0, lonJit),
  });

  // now memoize:
  const jitteredData = React.useMemo<JitteredDataPoint[]>(() => {
    return data.map((d) => {
      const { jitterLat, jitterLon } = applyDeterministicJitter(
        d,
        map_lat_jit * 0.5,
        map_lon_jit * 0.5
      );
      return { ...d, jitteredLat: jitterLat, jitteredLon: jitterLon };
    });
  }, [data, map_lat_jit, map_lon_jit]);

  useEffect(() => {
    // 1️⃣ Create the Leaflet map only once…
    if (!mapRef.current || !tooltipContainerRef.current) return;
    const bounds = L.latLngBounds(
      L.latLng(-85, -250), // Southwest corner
      L.latLng(85, 250) // Northeast corner
    );
    const map = L.map(mapRef.current, {
      center: [47, 2],
      zoom: 5,
      maxZoom: 10, // Set max zoom level to prevent zooming beyond bounds
      minZoom: 2.25, // Set min zoom level to prevent zooming beyond bounds
      maxBounds: bounds, // Set max bounds to restrict panning entirely
      maxBoundsViscosity: 1.0, // Set viscosity to 1 to completely block panning beyond bounds
      worldCopyJump: false, // Disable world copy to prevent wrapping at boundaries
      attributionControl: false, // Disable attribution control
    });
    map.getContainer().appendChild(tooltipContainerRef.current);
    // Create a new attribution control with position 'bottomleft'
    L.control
      .attribution({
        position: "bottomleft", // Position the attribution control in the lower left
      })
      .addTo(map);

    // Add a tile layer (OpenStreetMap)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 10,
      }
    ).addTo(map);

    // Add an SVG layer
    L.svg().addTo(map);

    mapInstance.current = map;
    // select the ref’d div only once, stash it in tooltipSelRef
    tooltipSelRef.current = d3
      .select(tooltipContainerRef.current)
      .attr("class", "map-tooltip")
      .style("position", "fixed")      // ← fixed instead of absolute
      .style("pointer-events", "none")
      .style("background", "white")
      .style("border", "1px solid #ccc")
      .style("padding", "5px")
      .style("border-radius", "4px")
      .style("box-shadow", "0 0 5px rgba(0,0,0,0.3)")
      .style("opacity", 0)
      .style("display", "none")
      .style("z-index", 1000);

    return () => {
      map.remove();
      // clean up tooltip selection
      tooltipSelRef.current?.remove();
    };
  }, []);

  // — 2) CIRCLE + LEGEND REDRAW —
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !tooltipSelRef.current) return;

    const svg = d3.select(map.getPanes().overlayPane).select("svg").style("pointer-events", "auto");


    // 1️⃣ clear out old circles & legend
    svg.selectAll(".circle_data, .circle_reg, .circle_pop, .circle_ind").remove();
    // 2️⃣ helper functions
    const project = (lat: number, lon: number) =>
      map.latLngToLayerPoint(new L.LatLng(lat, lon));

    // 3️⃣ scales & color functions
    const popColor = d3.scaleOrdinal(d3.schemeSet2)
      .domain([...new Set(data.map(d => d.pop))]);
    const { getColor, legendData, discreteOrContinuous } =
      createColorScale(data, var_1, var_1);
    // 4️⃣ draw circles by layer
    const zoom = map.getZoom();
    const factor = Math.pow(2, zoom - 5);
    if (map_data) {
      svg.selectAll(".circle_data")
        .data(jitteredData)
        .enter()
        .append("circle")
        .attr("class", "circle_data")
        .attr("cx", d => project(d.jitteredLat!, d.jitteredLon!).x)
        .attr("cy", d => project(d.jitteredLat!, d.jitteredLon!).y)
        .attr("r", map_data_rad * factor)
        .attr("fill", (d) => dataColorScale(d.dat))
        .attr("fill-opacity", 0.02);
    }
    if (map_reg) {
      svg
        .selectAll(".circle_reg")
        .data(jitteredData)
        .enter()
        .append("circle")
        .attr("class", "circle_reg")
        .attr("cx", d => project(d.jitteredLat!, d.jitteredLon!).x)
        .attr("cy", d => project(d.jitteredLat!, d.jitteredLon!).y)
        .attr("r", map_reg_rad * factor)
        .attr("fill", (d) => regColorScale(d.reg))
        .attr("fill-opacity", 0.4);
    }
    if (map_pop) {
      svg.selectAll(".circle_pop")
        .data(jitteredData)
        .enter()
        .append("circle")
        .attr("class", "circle_pop")
        .attr("cx", d => project(d.jitteredLat!, d.jitteredLon!).x)
        .attr("cy", d => project(d.jitteredLat!, d.jitteredLon!).y)
        .attr("r", map_pop_rad * factor)
        .attr("fill", d => popColor(d.pop))
        .attr("fill-opacity", 0.6);
    }

    const formatValue = (value: number | string | null, decimals = 3): string => {
      if (value === null || value === undefined) return 'N/A';
      if (typeof value === 'string') return value;
      if (value === 0) {
        return '0';
      }

      // Use scientific notation if |value| < 0.1:
      if (Math.abs(value) < 0.1) {
        // Convert to exponential with 'decimals' digits
        const exp = value.toExponential(decimals); // e.g. "9.000e-2"
        const [mantissaRaw, exponent] = exp.split('e');
        const mantissa = mantissaRaw.replace(/\.?0+$/, '');

        return `${mantissa}e${exponent}`;
      } else {
        // Use Intl.NumberFormat for comma separators.
        // "maximumFractionDigits" ensures up to `decimals` places
        // "minimumFractionDigits: 0" strips trailing zeros
        const formatter = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: decimals,
        });
        return formatter.format(value);
      }
    };

    function positionTooltip(event: MouseEvent, d: JitteredDataPoint) {
      const tooltip = tooltipSelRef.current!;
      const x = event.clientX + 10;
      const y = event.clientY + 10;

      tooltip
        .style("left", `${x}px`)
        .style("top", `${y}px`)
        .style("display", "block")
        .style("opacity", 1)
        .html(`
          <div style="font-size: 12px; max-width: 250px;">
            <strong>Individual:</strong> ${d.ind}<br/>
            <strong>Sex:</strong> ${d.sex}<br/>
            <strong>Dataset:</strong> ${d.dat}<br/>
            <strong>Region:</strong> ${d.reg}<br/>
            <strong>Population:</strong> ${d.pop}<br/>
            <strong>Chromosome:</strong> ${d.chrom}<br/>
            <strong>Haplotype:</strong> ${formatValue(d.hap)}<br/>
            <strong>Sequence:</strong> ${formatValue(d.seq)}<br/>
            <strong>Length (Mean):</strong> ${formatValue(d.len_mea)}<br/>
            <strong>Length (Median):</strong> ${formatValue(d.len_med)}<br/>
            <strong>Length (Max):</strong> ${formatValue(d.len_max)}<br/>
            <strong>Length (Min):</strong> ${formatValue(d.len_min)}<br/>
            ${d.ancAMR !== null ? `<strong>Ancestry AMR:</strong> ${formatValue(d.ancAMR)}<br/>` : ''}
            ${d.ancEAS !== null ? `<strong>Ancestry EAS:</strong> ${formatValue(d.ancEAS)}<br/>` : ''}
            ${d.ancSAS !== null ? `<strong>Ancestry SAS:</strong> ${formatValue(d.ancSAS)}<br/>` : ''}
            ${d.ancAFR !== null ? `<strong>Ancestry AFR:</strong> ${formatValue(d.ancAFR)}<br/>` : ''}
            ${d.ancEUR !== null ? `<strong>Ancestry EUR:</strong> ${formatValue(d.ancEUR)}<br/>` : ''}
            ${d.ancOCE !== null ? `<strong>Ancestry OCE:</strong> ${formatValue(d.ancOCE)}<br/>` : ''}
          </div>
        `);
    };
    // 5️⃣ individual circles + tooltips
    svg.selectAll(".circle_ind")
      .data(jitteredData)
      .enter()
      .append("circle")
      .attr("class", "circle_ind")
      .attr("cx", d => project(d.jitteredLat!, d.jitteredLon!).x)
      .attr("cy", d => project(d.jitteredLat!, d.jitteredLon!).y)
      .attr("r", map_ind_rad * factor)
      .attr("fill", getColor)
      .on("mouseover", (event, d) => {
        d3.select(event.currentTarget)
          .attr("stroke", "black")
          .attr("stroke-width", 2);
        positionTooltip(event as MouseEvent, d);
      })
      .on("mousemove", (event, d) => positionTooltip(event as MouseEvent, d))
      .on("mouseout", function () {
        // here, `this` is the SVG circle element
        d3.select<SVGCircleElement, JitteredDataPoint>(this)
          .attr("stroke-width", 0);

        tooltipSelRef.current!
          .style("display", "none")
          .style("opacity", 0);
      });

    // 6️⃣ keep circles in sync on pan/zoom
    const update = () => {
      const zf = Math.pow(2, map.getZoom() - 5);
      svg
        .selectAll<SVGCircleElement, JitteredDataPoint>(".circle_data")
        .attr("r", map_data_rad * zf)
        .attr("cx", d => project(d.jitteredLat, d.jitteredLon).x)
        .attr("cy", d => project(d.jitteredLat, d.jitteredLon).y);

      svg
        .selectAll<SVGCircleElement, JitteredDataPoint>(".circle_reg")
        .attr("r", map_reg_rad * zf)
        .attr("cx", d => project(d.jitteredLat, d.jitteredLon).x)
        .attr("cy", d => project(d.jitteredLat, d.jitteredLon).y);

      svg
        .selectAll<SVGCircleElement, JitteredDataPoint>(".circle_pop")
        .attr("r", map_pop_rad * zf)
        .attr("cx", d => project(d.jitteredLat, d.jitteredLon).x)
        .attr("cy", d => project(d.jitteredLat, d.jitteredLon).y);

      svg
        .selectAll<SVGCircleElement, JitteredDataPoint>(".circle_ind")
        .attr("r", map_ind_rad * zf)
        .attr("cx", d => project(d.jitteredLat, d.jitteredLon).x)
        .attr("cy", d => project(d.jitteredLat, d.jitteredLon).y);
    };
    map.on("moveend", update).on("zoomend", update);
    // Create the legend content
    const legendContainer = d3.select("#legend");
    legendContainer.selectAll("*").remove(); // Clear previous legend content
    const var1Short = toShortCol(var_1);
    // Create the main legend based on the "col" argument
    function createMainLegend() {
      const mainLegend = legendContainer
        .append("div")
        .attr("class", "main-legend")
        .style("margin-bottom", "10px");

      mainLegend
        .append("div")
        .text(var_1 || "Main Legend")
        .style("font-weight", "bold")
        .style("margin-bottom", "5px").style("font-size", "15px");

      // Populate main legend based on whether it’s continuous or discrete
      if (discreteOrContinuous === "continuous" && legendData[0].extent) {
        // Continuous gradient legend
        const gradientLegend = mainLegend
          .append("div")
          .append("svg")
          .attr("width", 150) // Increase width to accommodate text
          .attr("height", 120); // Increase height to fit text above and below

        // Append linear gradient
        const gradient = gradientLegend
          .append("defs")
          .append("linearGradient")
          .attr("id", "main-color-gradient")
          .attr("x1", "0%")
          .attr("y1", "100%")
          .attr("x2", "0%")
          .attr("y2", "0%");

        const extent = legendData[0].extent;
        const colorScale = d3
          .scaleSequential(d3.interpolateTurbo)
          .domain(extent);

        // Create gradient stops
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          gradient
            .append("stop")
            .attr("offset", `${t * 100}%`)
            .attr(
              "stop-color",
              colorScale(extent[0] + t * (extent[1] - extent[0]))
            );
        }

        // Draw the gradient rectangle
        gradientLegend
          .append("rect")
          .style("margin-right", "8px") // Center the rectangle in the svg
          .attr("y", 10) // Add some padding at the top
          .attr("width", "18px")
          .attr("height", 100)
          .style("fill", "url(#main-color-gradient)");

        // Add min label at the bottom of the gradient
        gradientLegend
          .append("text")
          .attr("x", 26)
          .attr("y", 110)
          .style("font-size", "15px")
          .text(`Min: ${formatValue(extent[0], 3)}`);

        // Add max label at the top of the gradient
        gradientLegend
          .append("text")
          .attr("x", 26) // Position to the right of the gradient rectangle
          .attr("y", 25)
          .style("font-size", "15px") // Adjust font size if needed
          .text(`Max: ${formatValue(extent[1], 3)}`);
      } else {
        // Discrete legend
        legendData.forEach((item) => {
          const legendItem = mainLegend.append("div").style("display", "flex");
          legendItem
            .append("div")
            .style("width", "18px")
            .style("height", "18px")
            .style("background-color", item.color)
            .style("margin-right", "8px");
          legendItem.append("span").text(item.label);
        });
      }
    }

    createMainLegend();

    // Function to create a discrete legend
    function createDiscreteLegend(
      container: d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>,
      title: string,
      colorInput: Record<string, string> | d3.ScaleOrdinal<string, string>,
      selectedValues: string[]
    ) {
      const legend = container.append("div").style("margin-bottom", "10px");

      legend
        .append("div")
        .text(title)
        .style("font-weight", "bold")
        .style("margin-bottom", "5px").style("font-size", "15px");

      // Handle both predefined colormaps and D3 scales
      selectedValues.forEach((key) => {
        const color =
          typeof colorInput === "function"
            ? colorInput(key) // For D3 scales
            : colorInput[key]; // For plain colormap objects

        if (color) {
          const displayLabel = mappingToLong[key as keyof typeof mappingToLong] ?? key;
          const item = legend
            .append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("margin-bottom", "3px");

          item
            .append("div")
            .style("width", "18px")
            .style("height", "18px")
            .style("background-color", color)
            .style("margin-right", "8px");

          item.append("span").text(displayLabel).style("font-size", "15px");
        }
      });
    }

    // Add Dataset legend if map_data is enabled
    if (map_reg) {
      const selectedRegionValues = [...new Set(data.map((d) => d.reg))];
      createDiscreteLegend(
        legendContainer,
        "Region",
        reg_cmaps,
        selectedRegionValues
      );
    }

    if (map_data) {
      const selectedDataValues = [...new Set(data.map((d) => d.dat))];
      createDiscreteLegend(
        legendContainer,
        "Dataset",
        data_cmaps,
        selectedDataValues
      );
    }

    if (map_pop) {
      const selectedPopulationValues = [...new Set(data.map((d) => d.pop))];
      createDiscreteLegend(
        legendContainer,
        "Population",
        popColorScale,
        selectedPopulationValues
      );
    }
    return () => {
      map.off("moveend", update).off("zoomend", update);
    };

  }, [
    data,
    map_data, map_data_rad,
    map_reg, map_reg_rad,
    map_pop, map_pop_rad,
    map_ind_rad,
    map_lat_jit, map_lon_jit
  ]);



  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div
        ref={mapRef}
        style={{ position: "relative", width: "100%", height: "100%" }}
      >
        <div
          id="legend"
          style={{
            position: "absolute",
            bottom: "3%",
            left: "1%",
            backgroundColor: "white",
            padding: "10px",
            borderRadius: "4px",
            boxShadow: "0 0 5px rgba(0, 0, 0, 0.3)",
            zIndex: 1000,
          }}
        />
        <div ref={tooltipContainerRef} />
      </div>
    </div>
  );
};

export default React.memo(MapComponent);
