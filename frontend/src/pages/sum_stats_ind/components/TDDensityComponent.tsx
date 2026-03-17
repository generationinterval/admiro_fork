import { anc_cmaps, data_cmaps, reg_cmaps } from "@/assets/colormaps";
import { mapping } from "@/pages/sum_stats_ind/static/mapping";
import { DataPoint } from "@/types/sum_stat_ind_datapoint";
import * as d3 from "d3";
import React, { useCallback, useEffect, useRef } from "react";

// Define the props for a 2D density plot.
// Note: We now have two mapped variables and separate booleans for mean/median lines.
type old_TDDensityPlotProps = {
  data: DataPoint[];
  var_x: string;
  var_y: string;
  col: string[]; // You can later extend this to support grouping/coloring if needed.
  isSidebarVisible: boolean;
  mea_med_x: boolean;
  mea_med_y: boolean;
  x_axis: string;
  min_x_axis: number;
  max_x_axis: number;
  y_axis: string;
  min_y_axis: number;
  max_y_axis: number;
  bandwidth_divisor: number;
  thresholds: number;
};

type TDDensityPlotProps = {
  data: DataPoint[];
  phases: string[];
  tree_lin: string[];
  var_x: string;
  var_y: string;
  col: string[];
  ancs: string[];
  chroms: string[];
  regs: string[];
  fac_x: string[];
  fac_y: string[];
  mea_med_x: boolean;
  mea_med_y: boolean;
  bandwidth_divisor: number;
  x_axis: string;
  min_x_axis: number;
  max_x_axis: number;
  y_axis: string;
  min_y_axis: number;
  max_y_axis: number;
  isSidebarVisible: boolean;
  thresholds: number;
};

// -------------------- Helpers --------------------
const toShortCol = (s: string) => mapping.toShort[s] ?? s;
const toLongCol = (k: string) => mapping.toLong[k] ?? k;
const asNum = (x: unknown) => (x === null || x === undefined ? NaN : +x);


const keyFromCols =
  (colsShort: string[]) =>
    (d: DataPoint): string => {
      if (colsShort.length === 0) return "Mean / Median";
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
  col: string[],
  var_1: string
): {
  getColor: (d: DataPoint) => string;
  getColorFromKey: (key: string) => string;
  legendData: { label: string; color: string; extent?: [number, number] }[];
  discreteOrContinuous: string;
  globalColorOrder: string[];
} => {
  let getColor: (d: DataPoint) => string;
  let getColorFromKey: (key: string) => string;
  let legendData: { label: string; color: string; extent?: [number, number] }[];
  let discreteOrContinuous: string;
  let globalColorOrder: string[] = [];

  const var1Short = toShortCol(var_1);
  const colShort = col.map(toShortCol);
  const colorKey = keyFromCols(colShort);

  if (col.length === 1 && col[0] === "") {
    const defaultColor = "steelblue";
    getColor = () => defaultColor;
    getColorFromKey = () => defaultColor;
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


    if (colShort.length === 1 && ["reg", "dat", "anc"].includes(colShort[0])) {
      let chosenMap: Record<string, string> = {};
      if (colShort[0] === "reg") chosenMap = reg_cmaps;
      else if (colShort[0] === "dat") chosenMap = data_cmaps;
      else if (colShort[0] === "anc") chosenMap = anc_cmaps;

      getColor = (d) => {
        const val = colorKey(d);
        if (!val) return "steelblue";
        return chosenMap[val] || "steelblue";
      };

      getColorFromKey = (key) => {
        if (!key || key === "__missing__") return "steelblue";
        return chosenMap[key] || "steelblue";
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

      getColorFromKey = (key) => {
        return key && key !== "__missing__" ? colorScale(String(key)) : "steelblue";
      };

      legendData = globalColorOrder.map((value) => ({
        label: String(value),
        color: colorScale(value),
      }));

      discreteOrContinuous = "discrete";
    }
  }
  return { getColor, getColorFromKey, legendData, discreteOrContinuous, globalColorOrder };
};


const drawTDDensity = (
  facetGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  facetData: DataPoint[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  plotHeight: number,
  plotWidth: number,
  var_x: string,
  var_y: string,
  getColor: (d: DataPoint) => string,
  getColorFromKey: (key: string) => string,
  globalColorOrder: string[], // Pass global color order
  mea_med_x: boolean,
  mea_med_y: boolean,
  title: string,
  x_label: string,
  y_label: string,
  bandwidth_divisor: number,
  thresholds: number,
  legendData: { label: string; color: string; extent?: [number, number] }[]
) => {


  const varXShort = toShortCol(var_x);
  const varYShort = toShortCol(var_y);

  // Compute 2D density contours using d3.contourDensity.

  const densityData = d3
    .contourDensity<DataPoint>()
    .x((d) => xScale(+d[varXShort as keyof DataPoint]! as number))
    .y((d) => yScale(+d[varYShort as keyof DataPoint]! as number))
    .size([plotWidth, plotHeight])
    .bandwidth(bandwidth_divisor)
    .thresholds(thresholds)(facetData);

  // Create a color scale for the density values.
  const densityValues = densityData.map((d) => d.value);
  const densityMin = d3.min(densityValues) || 0;
  const densityMax = d3.max(densityValues) || 1;
  const colorScale = d3
    .scaleSequential(d3.interpolateViridis)
    .domain([densityMin, densityMax]);

  facetGroup
    .append("g").attr("transform", `translate(0,${plotHeight})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format(".1e")));
  facetGroup
    .append("g")
    .call(d3.axisLeft(yScale).tickFormat(d3.format(".1e")));
  // X label
  facetGroup
    .append("text")
    .attr("x", plotWidth / 2)
    .attr("y", plotHeight + 35)
    .attr("text-anchor", "middle")
    .text(x_label);

  // Y label
  facetGroup
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -plotHeight / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .text(y_label);
  // Plot title
  facetGroup
    .append("text")
    .attr("x", plotWidth / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .text(title);
  // Draw the density contours.
  facetGroup
    .append("g")
    .selectAll("path")
    .data(densityData)
    .enter()
    .append("path")
    .attr("d", d3.geoPath())
    .attr("fill", (d) => colorScale(d.value))
    .attr("stroke", "#000")
    .attr("stroke-width", 0.5)
    .attr("stroke-linejoin", "round");

  // Optionally, draw mean and median lines.

  if (mea_med_x || mea_med_y) {
    const colorGroups = d3.group(facetData, (d) => getColor(d));
    colorGroups.forEach((groupData, groupKey) => {
      const container = d3.select("#plot-container");
      const tooltip = container.append("div").attr("class", "tooltip");
      const groupLabel = legendData.find(d => d.color === groupKey)?.label;


      // Calculate mean and median for x and y
      if (mea_med_x) {
        const mean_x = d3.mean(
          groupData,
          (d) => d[varXShort as keyof DataPoint] as number
        )!;
        const median_x = d3.median(
          groupData,
          (d) => d[varXShort as keyof DataPoint] as number
        )!;
        // Draw mean line for x (vertical line)
        facetGroup
          .append("line")
          .attr("x1", xScale(mean_x))
          .attr("x2", xScale(mean_x))
          .attr("y1", yScale.range()[0])
          .attr("y2", yScale.range()[1])
          .attr("stroke", groupKey)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1); // Show tooltip
            tooltip.html(
              `<strong>Group:</strong> ${groupLabel}<br/><strong>Mean:</strong> ${mean_x.toFixed(2)}`
            );
          })
          .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node()); // Ensure the mouse position is relative to the container
            tooltip
              .style("left", `${mouseX + 10}px`)
              .style("top", `${mouseY - 28}px`);
          })
          .on("mouseleave", () => {
            tooltip.transition().duration(200).style("opacity", 0); // Hide tooltip
          });

        // Draw median line for x (vertical line)
        facetGroup
          .append("line")
          .attr("x1", xScale(median_x))
          .attr("x2", xScale(median_x))
          .attr("y1", yScale.range()[0])
          .attr("y2", yScale.range()[1])
          .attr("stroke", groupKey)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "2,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(
              `<strong>Group:</strong> ${groupLabel}<br/><strong>Mean:</strong> ${median_x.toFixed(2)}`
            );
          })
          .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node());
            tooltip
              .style("left", `${mouseX + 10}px`)
              .style("top", `${mouseY - 28}px`);
          })
          .on("mouseleave", () => {
            tooltip.transition().duration(200).style("opacity", 0);
          });
      }

      if (mea_med_y) {
        const mean_y = d3.mean(
          groupData,
          (d) => d[varYShort as keyof DataPoint] as number
        )!;
        const median_y = d3.median(
          groupData,
          (d) => d[varYShort as keyof DataPoint] as number
        )!;

        // Draw mean line for y (horizontal line)
        facetGroup
          .append("line")
          .attr("x1", xScale.range()[0])
          .attr("x2", xScale.range()[1])
          .attr("y1", yScale(mean_y))
          .attr("y2", yScale(mean_y))
          .attr("stroke", groupKey)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1); // Show tooltip
            tooltip.html(
              `<strong>Group:</strong> ${groupLabel
              }<br/><strong>Mean Y:</strong> ${mean_y.toFixed(2)}`
            );
          })
          .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node());
            tooltip
              .style("left", `${mouseX + 10}px`)
              .style("top", `${mouseY - 28}px`);
          })
          .on("mouseleave", () => {
            tooltip.transition().duration(200).style("opacity", 0);
          });

        // Draw median line for y (horizontal line)
        facetGroup
          .append("line")
          .attr("x1", xScale.range()[0])
          .attr("x2", xScale.range()[1])
          .attr("y1", yScale(median_y))
          .attr("y2", yScale(median_y))
          .attr("stroke", groupKey)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "2,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(
              `<strong>Group:</strong> ${groupLabel
              }<br/><strong>Median Y:</strong> ${median_y.toFixed(2)}`
            );
          })
          .on("mousemove", (event) => {
            const [mouseX, mouseY] = d3.pointer(event, container.node());
            tooltip
              .style("left", `${mouseX + 10}px`)
              .style("top", `${mouseY - 28}px`);
          })
          .on("mouseleave", () => {
            tooltip.transition().duration(200).style("opacity", 0);
          });
      }
    });
  }



};

// This function clears the SVG and draws the 2D density plot.
const fullTDDensity = (
  svgElement: SVGSVGElement,
  data: DataPoint[],
  phases: string[],
  tree_lin: string[],
  var_x: string,
  var_y: string,
  col: string[],
  ancs: string[],
  chroms: string[],
  regs: string[],
  fac_x: string[],
  fac_y: string[],
  mea_med_x: boolean,
  mea_med_y: boolean,
  bandwidth_divisor: number,
  x_axis: string,
  min_x_axis: number,
  max_x_axis: number,
  y_axis: string,
  min_y_axis: number,
  max_y_axis: number,
  isSidebarVisible: boolean,
  thresholds: number,
) => {


  const extentWithBuffer = (pts: DataPoint[], keyShort: string, bufferFrac = 0.05): [number, number] => {
    const vals = pts
      .map((d) => asNum((d as any)[keyShort]))
      .filter(Number.isFinite);

    // fallback (no valid numbers)
    if (vals.length === 0) return [0, 1];

    let mn = d3.min(vals)!;
    let mx = d3.max(vals)!;

    // avoid degenerate domain
    if (mn === mx) {
      mn -= 1;
      mx += 1;
    }

    const buf = (mx - mn) * bufferFrac;
    return [mn - buf, mx + buf];
  };
  const containerSel = d3.select(svgElement.parentElement as HTMLElement);

  containerSel.selectAll("div.tooltip").remove();
  const tooltip = containerSel.append("div").attr("class", "tooltip");
  const meaMedTooltip = containerSel.append("div").attr("class", "tooltip");

  const ancFields = ["ancAMR", "ancEAS", "ancSAS", "ancAFR", "ancEUR", "ancOCE"] as const;
  function filterOutNullAncestryFields(data: DataPoint[], var_x: string, var_y: string) {
    const varXShort = toShortCol(var_x);
    const varYShort = toShortCol(var_y);

    const varXIsAnc = ancFields.includes(varXShort as any);
    const varYIsAnc = ancFields.includes(varYShort as any);

    if (!varXIsAnc && !varYIsAnc) return data;

    return data.filter((d) => {
      if (varXIsAnc && (d as any)[varXShort] === null) return false;
      if (varYIsAnc && (d as any)[varYShort] === null) return false;
      return true;
    });
  }

  // --- Build filter sets (short values) ---
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



  filteredData = filterOutNullAncestryFields(filteredData, var_x, var_y);
  data = filteredData;
  const varXShort = toShortCol(var_x);
  const varYShort = toShortCol(var_y);

  data = data.filter((d) => Number.isFinite(asNum((d as any)[varXShort])));
  data = data.filter((d) => Number.isFinite(asNum((d as any)[varYShort])));

  d3.select(svgElement).selectAll("*").remove();

  // Set up margins and dimensions.
  const container = svgElement.parentElement;

  const margin = { top: 50, right: 30, bottom: 80, left: 75 };
  const width = container ? container.clientWidth : 960;
  const height = container ? container.clientHeight : 600;
  const { getColor, getColorFromKey, legendData, discreteOrContinuous, globalColorOrder } =
    createColorScale(data, col, var_x);
  // Extract unique values for faceting directly from the data
  type FacetGroup = { key: string; title: string; points: DataPoint[] };

  function buildFacetGroups(data: DataPoint[], facXLong: string[]): FacetGroup[] {
    const facColsShort = (facXLong ?? []).map(toShortCol).filter((k) => k.length > 0);

    if (facColsShort.length === 0) {
      return [{ key: "__all__", title: "", points: data }];
    }

    const groups = new Map<string, { title: string; points: DataPoint[] }>();

    for (const d of data) {
      const key = facColsShort.map((k) => `${k}=${String((d as any)[k] ?? "NA")}`).join("|");
      const title = facColsShort
        .map((k) => `${toLongCol(k)}: ${toLongValue(k, (d as any)[k])}`)
        .join("\n");

      const existing = groups.get(key);
      if (!existing) groups.set(key, { title, points: [d] });
      else existing.points.push(d);
    }

    return Array.from(groups.entries())
      .map(([key, v]) => ({ key, title: v.title, points: v.points }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  const facetsX = buildFacetGroups(data, fac_x);
  const facetsY = buildFacetGroups(data, fac_y);

  const facetingRequiredX = facetsX.length > 1;
  const facetingRequiredY = facetsY.length > 1;
  const numCols = facetingRequiredX ? facetsX.length : 1;
  const numRows = facetingRequiredY ? facetsY.length : 1;


  const colPadding = 60;
  const rowPadding = 70;


  const plotWidth =
    numCols === 1
      ? width - margin.right - margin.left - colPadding
      : (width - margin.right - margin.left) / numCols - colPadding;
  const plotHeight =
    numRows === 1
      ? height - margin.bottom - margin.top - rowPadding
      : (height - margin.bottom - margin.top) / numRows - rowPadding;
  // Append a group element to respect the margins.
  const svg = d3
    .select(svgElement)
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(0,0)`);
  // Define the x and y scales.
  const xScale = d3.scaleLinear().range([0, plotWidth]);
  const yScale = d3.scaleLinear().range([plotHeight, 0]);

  // Discrete legend
  const padding = 30;
  let cumulativeWidth = 0;
  const legend = svg.append("g").attr(
    "transform",
    `translate(${margin.left + colPadding / 2}, ${height - rowPadding / 1.5})` // Start legend at the leftmost point of the container
  );
  // Create legend items dynamically
  if (mea_med_x || mea_med_y) {
    legendData.forEach((d) => {
      // Append rectangle for the color box
      legend
        .append("rect")
        .attr("x", cumulativeWidth)
        .attr("y", 0)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", d.color);

      // Append text label
      const text = legend
        .append("text")
        .attr("x", cumulativeWidth + 24) // Position text next to the rectangle
        .attr("y", 9) // Center text vertically with the rectangle
        .attr("dy", ".35em")
        .text(d.label);

      const textNode = text.node();
      if (textNode) {
        const textWidth = textNode.getBBox().width;
        cumulativeWidth += 18 + textWidth + padding; // Update cumulative width with rectangle, text, and padding
      }
    });
  }
  if (x_axis === "Shared Axis") {
    const xExtent = d3.extent(data, d => +d[varXShort as keyof DataPoint]!) as [number, number];
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% of the range
    xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).range([0, plotWidth]);
  }
  else if (x_axis === "Define Range") {
    xScale.domain([min_x_axis, max_x_axis]).range([0, plotWidth]);
  }
  if (y_axis === "Shared Axis") {
    const yExtent = d3.extent(data, d => +d[varYShort as keyof DataPoint]!) as [number, number];
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% of the range
    yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).range([plotHeight, 0]);
  }
  else if (y_axis === "Define Range") {
    yScale.domain([min_y_axis, max_y_axis]).range([plotHeight, 0]);
  }

  if (facetingRequiredX && facetingRequiredY) {
    // Apply faceting on both fac_x and fac_y
    facetsX.forEach((gx, i) => {
      const setX = new Set(gx.points);
      facetsY.forEach((gy, j) => {
        const facetData = gy.points.filter((d) => setX.has(d));

        const facetGroup = svg
          .append("g")
          .attr(
            "transform",
            `translate(${margin.left +
            (i * plotWidth +
              i * (colPadding / 2) +
              (i + 1) * (colPadding / 2))
            },${margin.top +
            j * plotHeight +
            j * (rowPadding / 2) +
            (j + 1) * (rowPadding / 2)
            })`
          );
        const title = `${gx.title} / ${gy.title}`;
        const x_label = var_x
        const y_label = var_y

        if (x_axis === "Free Axis") {
          const xExtent = d3.extent(facetData, d => +d[varXShort as keyof DataPoint]!) as [number, number];
          const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% of the range
          xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).range([0, plotWidth]);
        }
        if (y_axis === "Free Axis") {
          const yExtent = d3.extent(facetData, d => +d[varYShort as keyof DataPoint]!) as [number, number];
          const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% of the range
          yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).range([plotHeight, 0]);
        };

        drawTDDensity(
          facetGroup,
          facetData,
          xScale,
          yScale,
          plotHeight,
          plotWidth,
          var_x,
          var_y,
          getColor,
          getColorFromKey,
          globalColorOrder,
          mea_med_x,
          mea_med_y,
          title,
          x_label,
          y_label,
          bandwidth_divisor,
          thresholds,
          legendData
        );
      });
    });
  } else if (facetingRequiredX) {
    // Apply faceting on fac_x only
    facetsX.forEach((gx, i) => {
      const facetData = gx.points;

      const j = 0;
      // Append a group for each facet
      const facetGroup = svg.append("g").attr(
        "transform",
        `translate(${margin.left +
        (i * plotWidth + i * (colPadding / 2) + (i + 1) * (colPadding / 2))
        },${margin.top +
        j * plotHeight +
        j * (rowPadding / 2) +
        (j + 1) * (rowPadding / 2)
        })
          `
      );

      const title = `${gx.title}`;
      const x_label = var_x
      const y_label = var_y

      if (x_axis === "Free Axis") {
        const xExtent = d3.extent(facetData, d => +d[varXShort as keyof DataPoint]!) as [number, number];
        const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% of the range
        xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).range([0, plotWidth]);
      }
      if (y_axis === "Free Axis") {
        const yExtent = d3.extent(facetData, d => +d[varYShort as keyof DataPoint]!) as [number, number];
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% of the range
        yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).range([plotHeight, 0]);
      };

      drawTDDensity(
        facetGroup,
        facetData,
        xScale,
        yScale,
        plotHeight,
        plotWidth,
        var_x,
        var_y,
        getColor,
        getColorFromKey,
        globalColorOrder,
        mea_med_x,
        mea_med_y,
        title,
        x_label,
        y_label,
        bandwidth_divisor,
        thresholds,
        legendData
      );
    });
  } else if (facetingRequiredY) {
    // Apply faceting on fac_x only
    facetsY.forEach((gy, j) => {
      const facetData = gy.points;
      const i = 0;

      // Append a group for each facet
      const facetGroup = svg.append("g").attr(
        "transform",
        `translate(${margin.left +
        (i * plotWidth + i * (colPadding / 2) + (i + 1) * (colPadding / 2))
        },${margin.top +
        j * plotHeight +
        j * (rowPadding / 2) +
        (j + 1) * (rowPadding / 2)
        })
          `
      );

      const title = `${gy.title}`;
      const x_label = var_x
      const y_label = var_y
      if (x_axis === "Free Axis") {
        const xExtent = d3.extent(facetData, d => +d[varXShort as keyof DataPoint]!) as [number, number];
        const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% of the range
        xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).range([0, plotWidth]);
      }
      if (y_axis === "Free Axis") {
        const yExtent = d3.extent(facetData, d => +d[varYShort as keyof DataPoint]!) as [number, number];
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% of the range
        yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).range([plotHeight, 0]);
      };

      drawTDDensity(
        facetGroup,
        facetData,
        xScale,
        yScale,
        plotHeight,
        plotWidth,
        var_x,
        var_y,
        getColor,
        getColorFromKey,
        globalColorOrder,
        mea_med_x,
        mea_med_y,
        title,
        x_label,
        y_label,
        bandwidth_divisor,
        thresholds,
        legendData
      );
    });
  }
  else {
    const i = 0;
    const j = 0;
    const facetGroup = svg.append("g").attr(
      "transform",
      `translate(${margin.left +
      (i * plotWidth + i * (colPadding / 2) + (i + 1) * (colPadding / 2))
      },${margin.top +
      j * plotHeight +
      j * (rowPadding / 2) +
      (j + 1) * (rowPadding / 2)
      })
          `
    );
    const title = ``;
    const x_label = var_x
    const y_label = var_y

    if (x_axis === "Free Axis") {
      const xExtent = d3.extent(data, d => +d[varXShort as keyof DataPoint]!) as [number, number];
      const xPadding = (xExtent[1] - xExtent[0]) * 0.1; // 10% of the range
      xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).range([0, plotWidth]);
    }
    if (y_axis === "Free Axis") {
      const yExtent = d3.extent(data, d => +d[varYShort as keyof DataPoint]!) as [number, number];
      const yPadding = (yExtent[1] - yExtent[0]) * 0.1; // 10% of the range
      yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).range([plotHeight, 0]);
    };
    drawTDDensity(
      facetGroup,
      data,
      xScale,
      yScale,
      plotHeight,
      plotWidth,
      var_x,
      var_y,
      getColor,
      getColorFromKey,
      globalColorOrder,
      mea_med_x,
      mea_med_y,
      title,
      x_label,
      y_label,
      bandwidth_divisor,
      thresholds,
      legendData
    );
  }
}

const TDDensityComponent: React.FC<TDDensityPlotProps> = ({
  data,
  phases,
  tree_lin,
  var_x,
  var_y,
  col,
  ancs,
  chroms,
  regs,
  fac_x,
  fac_y,
  mea_med_x,
  mea_med_y,
  bandwidth_divisor,
  x_axis,
  min_x_axis,
  max_x_axis,
  y_axis,
  min_y_axis,
  max_y_axis,
  isSidebarVisible,
  thresholds,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && Array.isArray(data) && data.length > 0) {
      fullTDDensity(
        svgRef.current,
        data,
        phases,
        tree_lin,
        var_x,
        var_y,
        col,
        ancs,
        chroms,
        regs,
        fac_x,
        fac_y,
        mea_med_x,
        mea_med_y,
        bandwidth_divisor,
        x_axis,
        min_x_axis,
        max_x_axis,
        y_axis,
        min_y_axis,
        max_y_axis,
        isSidebarVisible,
        thresholds,
      );

    }
  }, [
    data,
    tree_lin,
    var_x,
    var_y,
    col,
    ancs,
    chroms,
    regs,
    fac_x,
    fac_y,
    mea_med_x,
    mea_med_y,
    bandwidth_divisor,
    x_axis,
    min_x_axis,
    max_x_axis,
    y_axis,
    min_y_axis,
    max_y_axis,
    isSidebarVisible,
    thresholds,
  ]);

  const handleResize = useCallback(() => {
    if (containerRef.current && svgRef.current && data) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      svgRef.current.setAttribute("width", String(width));
      svgRef.current.setAttribute("height", String(height));
      fullTDDensity(
        svgRef.current,
        data,
        phases,
        tree_lin,
        var_x,
        var_y,
        col,
        ancs,
        chroms,
        regs,
        fac_x,
        fac_y,
        mea_med_x,
        mea_med_y,
        bandwidth_divisor,
        x_axis,
        min_x_axis,
        max_x_axis,
        y_axis,
        min_y_axis,
        max_y_axis,
        isSidebarVisible,
        thresholds,
      );

    }
  }, [
    data,
    tree_lin,
    var_x,
    var_y,
    col,
    ancs,
    chroms,
    regs,
    fac_x,
    fac_y,
    mea_med_x,
    mea_med_y,
    bandwidth_divisor,
    x_axis,
    min_x_axis,
    max_x_axis,
    y_axis,
    min_y_axis,
    max_y_axis,
    isSidebarVisible,
    thresholds,
  ]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);

    // Call handleResize immediately to initialize size
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [data, handleResize]);

  useEffect(() => {
    handleResize();
  }, [isSidebarVisible, handleResize,]);
  return (
    <div
      id="plot-container"
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <svg id="histogram" ref={svgRef} />
    </div>
  );
};
export default TDDensityComponent;
