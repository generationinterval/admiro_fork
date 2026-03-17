import { anc_cmaps, data_cmaps, reg_cmaps } from "@/assets/colormaps";
import {
  kernelDensityEstimator,
  kernelEpanechnikov,
} from "@/pages/sum_stats_ind/static/densityUtils";
import { mapping } from "@/pages/sum_stats_ind/static/mapping";
import { DataPoint } from "@/types/sum_stat_ind_datapoint";
import * as d3 from "d3";
import React, { useCallback, useEffect, useRef } from "react";

type ViolinPlotProps = {
  data: DataPoint[];
  phases: string[];
  tree_lin: string[];
  var_1: string;
  ancs: string[];
  chroms: string[];
  regs: string[];
  col: string[];
  fac_x: string[];
  mea_med_1: boolean;
  bandwidth_divisor: number;
  y_axis: string;
  min_y_axis: number;
  max_y_axis: number;
  isSidebarVisible: boolean;
};


// -------------------- Helpers --------------------
const toShortCol = (s: string) => mapping.toShort[s] ?? s;
const toLongCol = (k: string) => mapping.toLong[k] ?? k;
const asNum = (x: unknown) => (x === null || x === undefined ? NaN : +x);


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
  col: string[],
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
  const colShort = col.map(toShortCol);
  const colorKey = keyFromCols(colShort);

  if (col.length === 1 && col[0] === "") {
    const defaultColor = "steelblue";
    getColor = () => defaultColor;
    legendData = [{ label: "Default Color", color: defaultColor }];
    discreteOrContinuous = "default";
    globalColorOrder = [defaultColor];
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

      legendData = globalColorOrder.map((val) => ({
        // if val is short-coded value, try mapping.values[col0Short].toLong
        label: toLongValue(colShort[0], val),
        color: chosenMap[val] || "steelblue",
      }));

      discreteOrContinuous = "discrete";
    } else {
      const colorScale = d3
        .scaleOrdinal(d3.schemeCategory10)
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

// -------------------- drawViolin --------------------
const drawViolin = (
  facetGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: DataPoint[],
  xScale: d3.ScaleBand<string>,
  yScale: d3.ScaleLinear<number, number>,
  bandwidth_divisor: number,
  plotHeight: number,
  plotWidth: number,
  var_1: string,
  col: string[],
  getColor: (d: DataPoint) => string,
  discreteOrContinuous: string,
  globalColorOrder: string[],
  showMeanMedian: boolean,
  title: string,
  x_label: string,
  y_label: string,
  jitter: number,
  showYAxis: boolean,
  containerSel: d3.Selection<HTMLElement, unknown, null, undefined>,
  tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
  meaMedTooltip: d3.Selection<HTMLDivElement, unknown, null, undefined>,
) => {
  // keys (short)
  const var1Short = toShortCol(var_1);
  const colShort = col.map(toShortCol);
  const colorKey = keyFromCols(colShort);

  // container/tooltips
  //const containerSel = d3.select("#plot-container");
  // avoid infinite tooltips on rerender: remove previous ones
  //containerSel.selectAll("div.tooltip").remove();
  //const tooltip = containerSel.append("div").attr("class", "tooltip");
  //const meaMedTooltip = containerSel.append("div").attr("class", "tooltip");
  facetGroup
    .append("line")
    .attr("x1", 0)
    .attr("x2", plotWidth)
    .attr("y1", 0)
    .attr("y2", 0)
    .attr("stroke", "black");

  facetGroup
    .append("line")
    .attr("x1", plotWidth)
    .attr("x2", plotWidth)
    .attr("y1", -30)
    .attr("y2", plotHeight)
    .attr("stroke", "black");

  // extent on short var key
  const v = (d: DataPoint) => asNum((d as any)[var1Short]);
  const extent = d3.extent(data, v);

  if (extent[0] == null || extent[1] == null || !Number.isFinite(extent[0]) || !Number.isFinite(extent[1])) {
    throw new Error("No valid extent found for data");
  }
  const [minValue, maxValue] = extent;

  const bandwidth = (maxValue - minValue) / bandwidth_divisor;
  const samplePoints = d3.range(minValue, maxValue, (maxValue - minValue) / 3000);
  const kde = kernelDensityEstimator(kernelEpanechnikov(bandwidth), samplePoints);

  // sumstat grouped by category key
  const sumstat = Array.from(
    d3.group(data, (d) => colorKey(d)),
    ([key, value]) => ({
      key,
      value: kde(value.map((g) => v(g))),
    })
  );

  const maxNum = d3.max(sumstat, (d) => d3.max(d.value, (v) => v[1])) || 0;

  const xNum = d3
    .scaleLinear()
    .range([0, xScale.bandwidth()])
    .domain([-maxNum, maxNum]);


  // draw violin shapes
  facetGroup
    .selectAll("g.violin")
    .data(sumstat)
    .enter()
    .append("g")
    .attr("class", "violin")
    .attr("transform", (d) => `translate(${xScale(d.key) ?? 0},0)`)
    .each(function (d) {
      const foundItem = data.find((item) => colorKey(item) === d.key);

      d3.select(this)
        .append("path")
        .datum(d.value as [number, number][])
        .style("fill", () => (foundItem ? getColor(foundItem) : "steelblue"))
        .style("stroke", () => (foundItem ? getColor(foundItem) : "steelblue"))
        .style("fill-opacity", 0.5)
        .style("stroke-opacity", 0)
        .attr(
          "d",
          d3
            .area<[number, number]>()
            .x0((p) => xNum(-p[1]))
            .x1((p) => xNum(p[1]))
            .y((p) => yScale(p[0]))
            .curve(d3.curveCatmullRom)
        );
    });

  // points
  facetGroup
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => {
      const xValue = xScale(colorKey(d));
      return (
        (xValue !== undefined ? xValue : 0) +
        xScale.bandwidth() / 2 +
        (Math.random() - 0.5) * jitter * xScale.bandwidth()
      );
    })
    .attr("cy", (d) => yScale(v(d)))
    .attr("r", 1.2)
    .style("fill", (d) => getColor(d))
    .style("opacity", 0.7)
    .on("mouseenter", function (event, d) {

      tooltip.transition().duration(150).style("opacity", 1);
      tooltip.html(
        `<strong>Individual:</strong> ${d.ind}<br/>
         <strong>Sex:</strong> ${d.sex}<br/>
         <strong>Dataset:</strong> ${d.dat}<br/>
         <strong>Region:</strong> ${d.reg}<br/>
         <strong>Population:</strong> ${d.pop}<br/>
         <strong>Chromosome:</strong> ${d.chrom}<br/>
         <strong>Haplotype:</strong> ${d.hap}<br/>`
      );
    })
    .on("mousemove", function (event, d) {
      const [mouseX, mouseY] = d3.pointer(event, containerSel.node()); // Ensure the mouse position is relative to the container
      tooltip
        .style("left", `${mouseX + 10}px`)
        .style("top", `${mouseY - 28}px`);
    })
    .on("mouseleave", function () {
      tooltip.transition().duration(150).style("opacity", 0); // Hide tooltip
    });

  facetGroup
    .append("g")
    .attr("transform", `translate(0,${plotHeight})`)
    .call(d3.axisBottom(xScale));

  if (showYAxis) {
    facetGroup.append("g").call(d3.axisLeft(yScale));
    facetGroup
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -plotHeight / 2)
      .attr("y", -50)
      .attr("text-anchor", "middle")
      .text(y_label);

    facetGroup
      .append("line")
      .attr("x1", 0)
      .attr("x2", 0)
      .attr("y1", -30)
      .attr("y2", plotHeight)
      .attr("stroke", "black");
  }

  facetGroup
    .append("text")
    .attr("x", plotWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .each(function () {
      const titleText = d3.select(this);
      const lines = title.split("\n");
      lines.forEach((line, i) => {
        titleText
          .append("tspan")
          .attr("x", plotWidth / 2)
          .attr("y", -25 + i * 5)
          .attr("dy", `${i * 1.1}em`)
          .text(line);
      });
    });

  // mean/median lines: group by category key (NOT d.color)
  if (showMeanMedian) {
    const groups = d3.group(data, (d) => colorKey(d));

    groups.forEach((groupData, key) => {
      if (!groupData.length) return;

      const mean = d3.mean(groupData, v);
      const median = d3.median(groupData, v);
      if (mean == null || median == null) return;
      const sumstatForGroup = sumstat.find((s) => s.key === key);

      const getDensityAtValue = (
        ss: { key: string; value: any[][] } | undefined,
        yValue: number
      ) => {
        if (!ss) return 0;
        const closest = ss.value.reduce((prev, curr) =>
          Math.abs(curr[0] - yValue) < Math.abs(prev[0] - yValue) ? curr : prev
        );
        return closest[1];
      };

      const densityForMean = getDensityAtValue(sumstatForGroup, mean);
      const densityForMedian = getDensityAtValue(sumstatForGroup, median);

      const densityScale = d3
        .scaleLinear()
        .domain([0, maxNum])
        .range([0, xScale.bandwidth()]);

      const xPosition = xScale(key);

      if (xPosition === undefined) return;

      const strokeColor = d3.color(getColor(groupData[0]))!.darker(0.7).formatHex();

      // mean line
      facetGroup
        .append("line")
        .attr(
          "x1",
          xPosition +
          xScale.bandwidth() / 2 -
          densityScale(densityForMean) / 2
        )
        .attr(
          "x2",
          xPosition +
          xScale.bandwidth() / 2 +
          densityScale(densityForMean) / 2
        )
        .attr("y1", yScale(mean))
        .attr("y2", yScale(mean))
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,4")
        .on("mouseenter", () => {

          meaMedTooltip.transition().duration(150).style("opacity", 1);
          meaMedTooltip.html(
            `<strong>Group:</strong> ${key}<br/><strong>Mean:</strong> ${mean.toFixed(
              2
            )}`
          );
        })
        .on("mousemove", (event) => {
          const node = containerSel.node() as HTMLElement | null;
          if (!node) return;
          const [mouseX, mouseY] = d3.pointer(event, node);
          meaMedTooltip
            .style("left", `${mouseX + 10}px`)
            .style("top", `${mouseY - 28}px`);
        })
        .on("mouseleave", () => {
          meaMedTooltip.transition().duration(150).style("opacity", 0);
        });

      // median line
      facetGroup
        .append("line")
        .attr(
          "x1",
          xPosition +
          xScale.bandwidth() / 2 -
          densityScale(densityForMedian) / 2
        )
        .attr(
          "x2",
          xPosition +
          xScale.bandwidth() / 2 +
          densityScale(densityForMedian) / 2
        )
        .attr("y1", yScale(median))
        .attr("y2", yScale(median))
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "2,4")
        .on("mouseenter", () => {

          meaMedTooltip.transition().duration(150).style("opacity", 1);
          meaMedTooltip.html(
            `<strong>Group:</strong> ${key}<br/><strong>Median:</strong> ${median.toFixed(
              2
            )}`
          );
        })
        .on("mousemove", (event) => {
          const node = containerSel.node() as HTMLElement | null;
          if (!node) return;
          const [mouseX, mouseY] = d3.pointer(event, node);
          meaMedTooltip
            .style("left", `${mouseX + 10}px`)
            .style("top", `${mouseY - 28}px`);
        })
        .on("mouseleave", () => {
          meaMedTooltip.transition().duration(150).style("opacity", 0);
        });
    });
  }
};

// -------------------- Component --------------------
const ViolinComponent: React.FC<ViolinPlotProps> = ({
  data,
  phases,
  tree_lin,
  var_1,
  ancs,
  chroms,
  regs,
  col,
  fac_x,
  mea_med_1,
  bandwidth_divisor,
  y_axis,
  min_y_axis,
  max_y_axis,
  isSidebarVisible,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (svgRef.current && Array.isArray(data) && data.length > 0) {
      fullViolin(
        svgRef.current,
        data,
        phases,
        tree_lin,
        var_1,
        ancs,
        chroms,
        regs,
        col,
        fac_x,
        mea_med_1,
        bandwidth_divisor,
        y_axis,
        min_y_axis,
        max_y_axis,
        isSidebarVisible,
      );
    }
  }, [
    data,
    phases,
    tree_lin,
    var_1,
    ancs,
    chroms,
    regs,
    col,
    fac_x,
    mea_med_1,
    bandwidth_divisor,
    y_axis,
    min_y_axis,
    max_y_axis,
    isSidebarVisible,
  ]);

  const handleResize = useCallback(() => {
    if (containerRef.current && svgRef.current && Array.isArray(data) && data.length > 0) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      svgRef.current.setAttribute("width", String(width));
      svgRef.current.setAttribute("height", String(height));
      fullViolin(
        svgRef.current,
        data,
        phases,
        tree_lin,
        var_1,
        ancs,
        chroms,
        regs,
        col,
        fac_x,
        mea_med_1,
        bandwidth_divisor,
        y_axis,
        min_y_axis,
        max_y_axis,
        isSidebarVisible,
      );
    }
  }, [
    data,
    phases,
    tree_lin,
    var_1,
    ancs,
    chroms,
    regs,
    col,
    fac_x,
    mea_med_1,
    bandwidth_divisor,
    y_axis,
    min_y_axis,
    max_y_axis,
    isSidebarVisible,
  ]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [data, handleResize]);

  useEffect(() => {
    handleResize();
  }, [isSidebarVisible, handleResize]);

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

export default ViolinComponent;

// -------------------- fullViolin --------------------
const fullViolin = (
  svgElement: SVGSVGElement,
  data: DataPoint[],
  phases: string[],
  tree_lin: string[],
  var_1: string,
  ancs: string[],
  chroms: string[],
  regs: string[],
  col: string[],
  fac_x: string[],
  mea_med_1: boolean,
  bandwidth_divisor: number,
  y_axis: string,
  min_y_axis: number,
  max_y_axis: number,
  isSidebarVisible: boolean,
) => {

  const containerSel = d3.select(svgElement.parentElement as HTMLElement);

  containerSel.selectAll("div.tooltip").remove();

  const tooltip = containerSel.append("div").attr("class", "tooltip");
  const meaMedTooltip = containerSel.append("div").attr("class", "tooltip");

  const ancFields = ["ancAMR", "ancEAS", "ancSAS", "ancAFR", "ancEUR", "ancOCE"] as const;
  function filterOutNullAncestryFields(data: DataPoint[], var_1: string, col: string[]) {
    const var1Short = toShortCol(var_1);
    const colShort = col.map(toShortCol);

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



  filteredData = filterOutNullAncestryFields(filteredData, var_1, col);
  data = filteredData;

  const var1Short = toShortCol(var_1);
  data = data.filter((d) => Number.isFinite(asNum((d as any)[var1Short])));

  d3.select(svgElement).selectAll("*").remove();
  const container = svgElement.parentElement;

  const margin = { top: 50, right: 30, bottom: 80, left: 75 };
  const width = container ? container.clientWidth : 960;
  const height = container ? container.clientHeight : 600;

  const { getColor, legendData, discreteOrContinuous, globalColorOrder } =
    createColorScale(data, col, var_1);

  // --- Facet grouping: combinations of filters.fac_x ---
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

  const facets = buildFacetGroups(data, fac_x);
  const facetingRequiredX = facets.length > 1;
  const numCols = facetingRequiredX ? facets.length : 1;
  const basePlotWidth =
    numCols === 1
      ? width - margin.left - margin.right
      : (width - margin.left - margin.right) / numCols;

  // --- Compute xTickWidth based on number of unique x categories in each facet ---
  const facColsShort = (fac_x ?? []).map(toShortCol);
  const colShort = col.map(toShortCol);

  const facetKey = keyFromCols(facColsShort);
  const colorKey = keyFromCols(colShort);

  const groupedByFacet = d3.group(data, (d) => facetKey(d));

  let totalUniqueColors = 0;
  for (const [, points] of groupedByFacet) {
    const set = new Set<string>();
    for (const p of points) {
      const k = colorKey(p);
      if (k !== "") set.add(k);
    }
    totalUniqueColors += set.size;
  }
  if (totalUniqueColors === 0) totalUniqueColors = 1;

  const xTickWidth = (width - margin.left - margin.right) / totalUniqueColors;
  const plotHeight = height - margin.bottom - margin.top;

  const svg = d3
    .select(svgElement)
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(0,0)`);

  const yScale = d3.scaleLinear().range([plotHeight, 0]);

  // legend
  const padding = 30;
  let cumulativeWidth = 0;
  const legend = svg
    .append("g")
    .attr(
      "transform",
      `translate(${margin.left}, ${height - margin.bottom / 1.5})`
    );

  legendData.forEach((d) => {
    legend
      .append("rect")
      .attr("x", cumulativeWidth)
      .attr("y", 0)
      .attr("width", 18)
      .attr("height", 18)
      .style("fill", d.color);

    const text = legend
      .append("text")
      .attr("x", cumulativeWidth + 24)
      .attr("y", 9)
      .attr("dy", ".35em")
      .text(d.label);

    const textNode = text.node();
    if (textNode) {
      const textWidth = textNode.getBBox().width;
      cumulativeWidth += 18 + textWidth + padding;
    }
  });

  // x-axis title (use mapping, robust to short/long input)
  const x_title = svg.append("g").attr(
    "transform",
    `translate(${width / 2}, ${height - margin.bottom / 1.5})`
  );
  const x_label = col.map((c) => toLongCol(toShortCol(c))).join("-");
  x_title
    .append("text")
    .attr("x", 0)
    .attr("y", 9)
    .attr("text-anchor", "middle")
    .attr("dy", ".35em")
    .text(x_label);

  const y_label = toLongCol(toShortCol(var_1));


  // -------------------- Faceting render --------------------
  if (facetingRequiredX) {
    let accX = margin.left;

    facets.forEach((facet, i) => {
      const facetData = facet.points;


      // x categories present in this facet
      const xAxRange = Array.from(new Set(facetData.map((d) => colorKey(d)))).filter(
        (k) => k !== ""
      );

      const reorderedXAxRange = globalColorOrder.filter((k) => xAxRange.includes(k));

      const plotWidth = Math.max(1, reorderedXAxRange.length) * xTickWidth;

      const xScale = d3
        .scaleBand<string>()
        .range([0, plotWidth])
        .domain(reorderedXAxRange)
        .padding(0.05);

      const var1Short = toShortCol(var_1);

      if (y_axis === "Define Range") {
        yScale.domain([min_y_axis, max_y_axis]).range([plotHeight, 0]);
      } else if (y_axis === "Shared Axis") {
        const v = (d: DataPoint) => asNum((d as any)[var1Short]);

        const minVal = d3.min(data, v);
        const maxVal = d3.max(data, v);

        if (minVal == null || maxVal == null || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
          throw new Error(`Invalid y extent for ${var1Short}`);
        }

        const buffer = (maxVal - minVal) * 0.05;
        yScale.domain([minVal - buffer, maxVal + buffer]).range([plotHeight, 0]);
      }

      const facetGroup = svg
        .append("g")
        .attr("transform", `translate(${accX},${margin.top})`);

      accX += plotWidth;

      drawViolin(
        facetGroup,
        facetData,
        xScale,
        yScale,
        bandwidth_divisor,
        plotHeight,
        plotWidth,
        var_1,
        col,
        getColor,
        discreteOrContinuous,
        globalColorOrder,
        mea_med_1,
        facet.title, // <- pretty title from buildFacetGroups
        x_label,
        y_label,
        0.5,
        i === 0,
        containerSel,
        tooltip,
        meaMedTooltip
      );
    });
  } else {
    const plotWidth = basePlotWidth;

    const xScale = d3
      .scaleBand<string>()
      .range([0, plotWidth])
      .domain(globalColorOrder)
      .padding(0.05);

    const var1Short = toShortCol(var_1);

    if (y_axis === "Define Range") {
      yScale.domain([min_y_axis, max_y_axis]).range([plotHeight, 0]);
    } else if (y_axis === "Shared Axis") {
      const v = (d: DataPoint) => asNum((d as any)[var1Short]);

      const minVal = d3.min(data, v);
      const maxVal = d3.max(data, v);

      if (minVal == null || maxVal == null || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
        throw new Error(`Invalid y extent for ${var1Short}`);
      }

      const buffer = (maxVal - minVal) * 0.05;
      yScale.domain([minVal - buffer, maxVal + buffer]).range([plotHeight, 0]);
    }

    const facetGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    drawViolin(
      facetGroup,
      data,
      xScale,
      yScale,
      bandwidth_divisor,
      plotHeight,
      plotWidth,
      var_1,
      col,
      getColor,
      discreteOrContinuous,
      globalColorOrder,
      mea_med_1,
      "",
      x_label,
      y_label,
      0.5,
      true,
      containerSel,
      tooltip,
      meaMedTooltip
    );
  }
};
