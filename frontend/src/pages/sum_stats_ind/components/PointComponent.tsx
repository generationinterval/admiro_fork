/* import { anc_cmaps, data_cmaps, reg_cmaps } from "@/assets/colormaps";
import { variables } from "@/assets/sharedOptions";
import { mappingToLong, } from "@/pages/sum_stats_ind/static/ssiStatic";
import { DataPoint } from "@/types/sum_stat_ind_datapoint";
import * as d3 from "d3";
import * as jStat from "jstat";
import React, { useCallback, useEffect, useRef } from "react";

type PointPlotProps = {
  data: DataPoint[];
  var_x: string;
  var_y: string;
  col: string[];
  isSidebarVisible: boolean;
  mea_med_x: boolean;
  mea_med_y: boolean;
  x_axis: string;
  min_x_axis: number;
  max_x_axis: number;
  y_axis: string;
  min_y_axis: number;
  max_y_axis: number;
};

const createColorScale = (
  data: DataPoint[],
  col: string[]
): {
  getColor: (d: DataPoint) => string;
  legendData: { label: string; color: string; extent?: [number, number] }[];
  discreteOrContinuous: string;
  globalColorOrder: string[];
} => {
  const dataColorScale = (dat: string) => {
    return data_cmaps[dat as keyof typeof data_cmaps] || "#CCCCCC";
  };

  const regColorScale = (reg: string) => {
    return reg_cmaps[reg as keyof typeof reg_cmaps] || "#CCCCCC";
  };

  const ancColorScale = (anc: string) => {
    return anc_cmaps[anc as keyof typeof anc_cmaps] || "#CCCCCC";
  };
  let getColor: (d: DataPoint) => string;
  let legendData: { label: string; color: string; extent?: [number, number] }[];
  let discreteOrContinuous: string;
  let globalColorOrder: string[] = [];

  if (col.length === 1 && col[0] === "") {
    const defaultColor = "steelblue";
    getColor = () => defaultColor;
    legendData = [{ label: "Default Color", color: defaultColor }];
    discreteOrContinuous = "default";
    globalColorOrder = [defaultColor]; // Only one color, steelblue
  }
  // Rule 2: If the variable in col is continuous, create a continuous colormap
  else if (variables.continuousOptionsShort.includes(col[0])) {
    const extent = d3.extent(data, (d) => +d[col[0] as keyof DataPoint]!);
    const isExtentValid = extent[0] !== undefined && extent[1] !== undefined;
    const colorScale = d3
      .scaleSequential(d3.interpolateTurbo)
      .domain(extent as [number, number]);

    getColor = (d) => {
      const value = d[col[0] as keyof DataPoint];
      return value !== null && value !== undefined
        ? colorScale(+value)
        : "steelblue"; // Fallback color if value is undefined
    };

    legendData = isExtentValid
      ? [
        { label: `Min: ${extent[0]}`, color: colorScale(extent[0]!), extent },
        { label: `Max: ${extent[1]}`, color: colorScale(extent[1]!), extent },
      ]
      : [{ label: "No valid data", color: "steelblue" }]; // If extent is invalid
    discreteOrContinuous = "continuous";
    globalColorOrder = []; // Continuous variables don't have a strict "order" per se
  } else if (col.length === 1 && col[0] === "dat") {
    // Extract unique values
    const uniqueValues = [
      ...new Set(
        data
          .map((d) => d.dat)
          .filter((value) => value !== null && value !== undefined)
          .map(String)
      ),
    ];
    getColor = (d) => {
      const val = d.dat;
      return val !== null && val !== undefined
        ? dataColorScale(String(val))
        : "#CCCCCC";
    };
    legendData = uniqueValues.map((value) => ({
      label:
        variables.mappingToLong[
        value as keyof typeof variables.mappingToLong
        ] || value,
      color: dataColorScale(String(value)),
    }));

    discreteOrContinuous = "discrete";
    globalColorOrder = uniqueValues;
  } // 3) If col.length = 1 and col = "reg"
  else if (col.length === 1 && col[0] === "reg") {
    const uniqueValues = [
      ...new Set(
        data
          .map((d) => d.reg)
          .filter((value) => value !== null && value !== undefined)
          .map(String)
      ),
    ];

    getColor = (d) => {
      const val = d.reg;
      return val !== null && val !== undefined
        ? regColorScale(String(val))
        : "#CCCCCC";
    };

    legendData = uniqueValues.map((value) => ({
      label:
        variables.mappingToLong[
        value as keyof typeof variables.mappingToLong
        ] || value,
      color: regColorScale(String(value)),
    }));

    discreteOrContinuous = "discrete";
    globalColorOrder = uniqueValues;
  }
  // 4) If col.length = 1 and col = "anc"
  else if (col.length === 1 && col[0] === "anc") {
    const uniqueValues = [
      ...new Set(
        data
          .map((d) => d.anc)
          .filter((value) => value !== null && value !== undefined)
          .map(String)
      ),
    ];

    getColor = (d) => {
      const val = d.anc;
      return val !== null && val !== undefined
        ? ancColorScale(String(val))
        : "#CCCCCC";
    };

    legendData = uniqueValues.map((value) => ({
      label:
        variables.mappingToLong[
        value as keyof typeof variables.mappingToLong
        ] || value,
      color: ancColorScale(String(value)),
    }));

    discreteOrContinuous = "discrete";
    globalColorOrder = uniqueValues;
  }

  // Rule 3: If the variable in col is discrete, create a categorical colormap
  else {
    const uniqueValues = [
      ...new Set(
        data
          .map((d) => d.color) // Extract "color" property from each DataPoint
          .filter((color) => color !== null && color !== undefined) // Filter out null and undefined values
          .map(String) // Convert all color values to strings (in case they're not)
      ),
    ];

    const colorScale = d3
      .scaleOrdinal(d3.schemeCategory10)
      .domain(uniqueValues);

    getColor = (d) => {
      const value = d.color;
      return value !== null && value !== undefined
        ? colorScale(String(value))
        : "steelblue"; // Fallback color if value is undefined
    };

    legendData = uniqueValues.map((value) => ({
      label:
        variables.mappingToLong[
        value as keyof typeof variables.mappingToLong
        ] || String(value),
      color: colorScale(value),
    }));
    discreteOrContinuous = "discrete";
    globalColorOrder = uniqueValues; // Set global order for categorical values
    console.log(legendData);
  }

  return { getColor, legendData, discreteOrContinuous, globalColorOrder };
};

const drawPoints = (
  facetGroup: d3.Selection<SVGGElement, unknown, null, undefined>,
  data: DataPoint[],
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  x_axis: string,
  min_x_axis: number,
  max_x_axis: number,
  all_min_x_axis: number,
  all_max_x_axis: number,
  y_axis: string,
  min_y_axis: number,
  max_y_axis: number,
  all_min_y_axis: number,
  all_max_y_axis: number,
  plotHeight: number,
  plotWidth: number,
  var_x: string,
  var_y: string,
  getColor: (d: DataPoint) => string,
  discreteOrContinuous: string,
  globalColorOrder: string[], // Pass global color order
  showMeanMedian_x: boolean,
  showMeanMedian_y: boolean,
  title: string,
  x_label: string,
  y_label: string
) => {
  // Adjust scales based on data
  xScale
    .domain(
      d3.extent(data, (d) => d[var_x as keyof DataPoint] as number) as [
        number,
        number
      ]
    )
    .range([0, plotWidth])
    .nice();
  if (x_axis === "Define Range") {
    xScale.domain([min_x_axis, max_x_axis]).range([0, plotWidth]);
  } else if (x_axis === "Shared Axis") {
    const buffer = (all_max_x_axis - all_min_x_axis) * 0.05;
    xScale
      .domain([all_min_x_axis - buffer, all_max_x_axis + buffer])
  } else if (x_axis === "Free Axis") {
    xScale
      .domain(
        d3.extent(data, (d) => d[var_x as keyof DataPoint] as number) as [
          number,
          number
        ]
      )
      .range([0, plotWidth])
      .nice();
  }



  if (y_axis === "Define Range") {
    yScale.domain([min_y_axis, max_y_axis]).range([plotHeight, 0]);
  } else if (y_axis === "Shared Axis") {
    const buffer = (all_max_y_axis - all_min_y_axis) * 0.05;
    yScale
      .domain([all_min_y_axis - buffer, all_max_y_axis + buffer])
      .range([plotHeight, 0]);
  } else if (y_axis === "Free Axis") {
    yScale
      .domain(
        d3.extent(data, (d) => d[var_y as keyof DataPoint] as number) as [
          number,
          number
        ]
      )
      .range([plotHeight, 0])
      .nice();
  }
  const displayTitle = mappingToLong[title as keyof typeof mappingToLong] ?? title;
  // Draw scatter plot points
  facetGroup
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d[var_x as keyof DataPoint] as number))
    .attr("cy", (d) => yScale(d[var_y as keyof DataPoint] as number))
    .attr("r", 3)
    .attr("fill", (d) => getColor(d))
    .attr("stroke", "none");

  // Add X Axis to the facet
  facetGroup
    .append("g")
    .attr("transform", `translate(0,${plotHeight})`)
    .call(d3.axisBottom(xScale));
  facetGroup
    .append("text")
    .attr("x", plotWidth / 2)
    .attr("y", plotHeight + 35) // Adjust this to move the label below the axis
    .attr("text-anchor", "middle")
    .text(x_label);

  // Add Y Axis to the facet
  facetGroup.append("g").call(d3.axisLeft(yScale));
  facetGroup
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -plotHeight / 2) // Center the Y axis title along the axis
    .attr("y", -70) // Adjust this to position the label to the left of the axis
    .attr("text-anchor", "middle")
    .text(y_label);

  // Add title to the facet
  facetGroup
    .append("text")
    .attr("x", plotWidth / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .text(`${displayTitle}`);



  // Draw mean and median lines if showMeanMedian_x or showMeanMedian_y is true
  if (showMeanMedian_x || showMeanMedian_y) {
    // Group data by color
    const colorGroups = d3.group(data, (d) => getColor(d));

    colorGroups.forEach((groupData, color) => {
      const container = d3.select("#plot-container"); // Assuming you have a div with this id
      const tooltip = container.append("div").attr("class", "tooltip");

      // Calculate mean and median for x and y
      if (showMeanMedian_x) {
        const mean_x = d3.mean(
          groupData,
          (d) => d[var_x as keyof DataPoint] as number
        )!;
        const median_x = d3.median(
          groupData,
          (d) => d[var_x as keyof DataPoint] as number
        )!;

        // Draw mean line for x (vertical line)
        facetGroup
          .append("line")
          .attr("x1", xScale(mean_x))
          .attr("x2", xScale(mean_x))
          .attr("y1", yScale.range()[0])
          .attr("y2", yScale.range()[1])
          .attr("stroke", d3.color(color)!.darker(0.7).formatHex())
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1); // Show tooltip
            tooltip.html(
              `<strong>Group:</strong> ${groupData[0].color
              }<br/><strong>Mean X:</strong> ${mean_x.toFixed(2)}`
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
          .attr("stroke", d3.color(color)!.darker(0.7).formatHex())
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "2,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(
              `<strong>Group:</strong> ${groupData[0].color
              }<br/><strong>Median X:</strong> ${median_x.toFixed(2)}`
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

      if (showMeanMedian_y) {
        const mean_y = d3.mean(
          groupData,
          (d) => d[var_y as keyof DataPoint] as number
        )!;
        const median_y = d3.median(
          groupData,
          (d) => d[var_y as keyof DataPoint] as number
        )!;

        // Draw mean line for y (horizontal line)
        facetGroup
          .append("line")
          .attr("x1", xScale.range()[0])
          .attr("x2", xScale.range()[1])
          .attr("y1", yScale(mean_y))
          .attr("y2", yScale(mean_y))
          .attr("stroke", d3.color(color)!.darker(0.7).formatHex())
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1); // Show tooltip
            tooltip.html(
              `<strong>Group:</strong> ${groupData[0].color
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
          .attr("stroke", d3.color(color)!.darker(0.7).formatHex())
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "2,4")
          .on("mouseenter", () => {
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(
              `<strong>Group:</strong> ${groupData[0].color
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

  // Draw linear trendlines with 95% confidence intervals
  // Group data by color
  const colorGroups = d3.group(data, (d) => getColor(d));

  colorGroups.forEach((groupData, color) => {
    // Prepare data
    const n = groupData.length;
    const xValues = groupData.map((d) => d[var_x as keyof DataPoint] as number);
    const yValues = groupData.map((d) => d[var_y as keyof DataPoint] as number);

    const sumX = d3.sum(xValues);
    const sumY = d3.sum(yValues);
    const sumXY = d3.sum(
      groupData,
      (d) =>
        (d[var_x as keyof DataPoint] as number) *
        (d[var_y as keyof DataPoint] as number)
    );
    const sumX2 = d3.sum(xValues, (x) => x * x);

    const meanX = sumX / n;
    const meanY = sumY / n;

    const ssXX = sumX2 - n * meanX * meanX;
    const ssXY = sumXY - n * meanX * meanY;

    const slope = ssXY / ssXX;
    const intercept = meanY - slope * meanX;

    // Residuals
    const residuals = groupData.map((d) => {
      const x = d[var_x as keyof DataPoint] as number;
      const y = d[var_y as keyof DataPoint] as number;
      const yPredicted = slope * x + intercept;
      return y - yPredicted;
    });

    const residualSumOfSquares = d3.sum(residuals, (r) => r * r);
    const sSquared = residualSumOfSquares / (n - 2);
    const s = Math.sqrt(sSquared);

    const ssXX_total = d3.sum(xValues, (x) => (x - meanX) ** 2);

    // t-value for 95% confidence interval
    const alpha = 0.05;
    const degreesOfFreedom = n - 2;
    const tValue = jStat.studentt.inv(1 - alpha / 2, degreesOfFreedom);

    // Generate x values for plotting the regression line and confidence intervals
    const xMin = d3.min(xValues)!;
    const xMax = d3.max(xValues)!;
    const xRange = d3.range(xMin, xMax, (xMax - xMin) / 100);

    const regressionData = xRange.map((x) => {
      const yPredicted = slope * x + intercept;
      const se = s * Math.sqrt(1 / n + (x - meanX) ** 2 / ssXX_total);
      const ci = tValue * se;

      return {
        x,
        yPredicted,
        CI_upper: yPredicted + ci,
        CI_lower: yPredicted - ci,
      };
    });

    // Create line and area generators
    const lineGenerator = d3
      .line<{ x: number; yPredicted: number }>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.yPredicted));

    const areaGenerator = d3
      .area<{ x: number; CI_upper: number; CI_lower: number }>()
      .x((d) => xScale(d.x))
      .y0((d) => yScale(d.CI_lower))
      .y1((d) => yScale(d.CI_upper));

    // Plot the confidence interval area
    facetGroup
      .append("path")
      .datum(regressionData)
      .attr("fill", color)
      .attr("opacity", 0.2)
      .attr("d", areaGenerator);

    // Plot the regression line
    facetGroup
      .append("path")
      .datum(regressionData)
      .attr("stroke", d3.color(color)!.darker(0.7).formatHex())
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("d", lineGenerator);
  });
};

const PointComponent: React.FC<PointPlotProps> = ({
  data,
  var_x,
  var_y,
  col,
  isSidebarVisible,
  mea_med_x,
  mea_med_y,
  x_axis,
  min_x_axis,
  max_x_axis,
  y_axis,
  min_y_axis,
  max_y_axis,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && Array.isArray(data) && data.length > 0) {
      fullPoints(
        svgRef.current,
        data,
        col,
        var_x,
        var_y,
        mea_med_x,
        mea_med_y,
        x_axis,
        min_x_axis,
        max_x_axis,
        y_axis,
        min_y_axis,
        max_y_axis
      );
    }
  }, [
    data,
    mea_med_x,
    mea_med_y,
    x_axis,
    min_x_axis,
    max_x_axis,
    y_axis,
    min_y_axis,
    max_y_axis,
  ]);

  const handleResize = useCallback(() => {
    if (containerRef.current && svgRef.current && data) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      svgRef.current.setAttribute("width", String(width));
      svgRef.current.setAttribute("height", String(height));
      fullPoints(
        svgRef.current,
        data,
        col,
        var_x,
        var_y,
        mea_med_x,
        mea_med_y,
        x_axis,
        min_x_axis,
        max_x_axis,
        y_axis,
        min_y_axis,
        max_y_axis
      );
    }
  }, [
    data,
    mea_med_x,
    mea_med_y,
    x_axis,
    min_x_axis,
    max_x_axis,
    y_axis,
    min_y_axis,
    max_y_axis,
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
  }, [isSidebarVisible, handleResize]);
  return (
    <div
      id="plot-container"
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      <svg id="point" ref={svgRef} />
    </div>
  );
};
export default PointComponent;

const fullPoints = (
  svgElement: SVGSVGElement,
  data: DataPoint[],
  col: string[],
  var_x: string,
  var_y: string,
  showMeanMedianX: boolean,
  showMeanMedianY: boolean,
  x_axis: string,
  min_x_axis: number,
  max_x_axis: number,
  y_axis: string,
  min_y_axis: number,
  max_y_axis: number
) => {
  const ancFields = [
    "ancAMR",
    "ancEAS",
    "ancSAS",
    "ancAFR",
    "ancEUR",
    "ancOCE",
  ];

  let filteredData = data;
  const varIsAncX = var_x && ancFields.includes(var_x);
  const varIsAncY = var_y && ancFields.includes(var_y); // Check var_y as well
  const colHasAnc = col.some((c) => ancFields.includes(c));

  if (varIsAncX || varIsAncY || colHasAnc) {
    filteredData = data.filter((d) => {
      let keep = true;

      // If var_x is an ancestry field, ensure it's not null
      if (varIsAncX && d[var_x as keyof DataPoint] === null) {
        keep = false;
      }

      // If var_y is an ancestry field, ensure it's not null
      if (varIsAncY && d[var_y as keyof DataPoint] === null) {
        keep = false;
      }

      // If any column in col is an ancestry field, ensure none are null
      if (colHasAnc) {
        for (const c of col) {
          if (ancFields.includes(c) && d[c as keyof DataPoint] === null) {
            keep = false;
            break;
          }
        }
      }

      return keep;
    });
  }

  // Proceed with filteredData instead of data
  data = filteredData;
  d3.select(svgElement).selectAll("*").remove();

  const container = svgElement.parentElement;
  const margin = { top: 0, right: 0, bottom: 60, left: 50 };
  const width = container ? container.clientWidth : 960;
  const height = container ? container.clientHeight : 600;
  const all_max_x_axis = d3.max(
    data,
    (d) => d[var_x as keyof DataPoint] as number
  )!;
  const all_min_x_axis = d3.min(
    data,
    (d) => d[var_x as keyof DataPoint] as number
  )!;
  const all_max_y_axis = d3.max(
    data,
    (d) => d[var_y as keyof DataPoint] as number
  )!;
  const all_min_y_axis = d3.min(
    data,
    (d) => d[var_y as keyof DataPoint] as number
  )!;
  console.log("all max x axis", all_max_x_axis);
  console.log("all min x axis", all_min_x_axis);
  console.log("all max y axis", all_max_y_axis);
  console.log("all min y axis", all_min_y_axis);
  const { getColor, legendData, discreteOrContinuous, globalColorOrder } =
    createColorScale(data, col);
  // Extract unique values for faceting directly from the data
  const uniqueFacX = [...new Set(data.map((d) => d.fac_x))].filter(
    (val) => val !== null
  );
  const uniqueFacY = [...new Set(data.map((d) => d.fac_y))].filter(
    (val) => val !== null
  );

  // Determine if faceting is needed
  const facetingRequiredX = uniqueFacX.length > 1;
  const facetingRequiredY = uniqueFacY.length > 1;

  // Determine number of rows and columns in the grid based on faceting
  const numCols = facetingRequiredX ? uniqueFacX.length : 1;
  const numRows = facetingRequiredY ? uniqueFacY.length : 1;

  const colPadding = 90;
  const rowPadding = 70;

  const plotWidth =
    numCols === 1
      ? width - margin.right - margin.left - colPadding
      : (width - margin.right - margin.left) / numCols - colPadding;
  const plotHeight =
    numRows === 1
      ? height - margin.bottom - margin.top - rowPadding
      : (height - margin.bottom - margin.top) / numRows - rowPadding;

  const svg = d3
    .select(svgElement)
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(0,0)`);

  const xScale = d3.scaleLinear().range([0, plotWidth]);

  const yScale = d3.scaleLinear().range([plotHeight, 0]);

  if (discreteOrContinuous === "continuous") {
    const legendWidth = 400; // Width of the gradient
    const legendHeight = 20; // Height of the gradient
    const legend = svg.append("g").attr(
      "transform",
      `translate(${margin.left + colPadding / 2}, ${height - rowPadding / 1.5})` // Center horizontally and place at the bottom
    );
    const extent = legendData[0].extent;

    if (extent) {
      // Create a color scale with interpolateViridis
      const colorScale = d3
        .scaleSequential()
        .domain(extent) // Set the domain to the extent values
        .interpolator(d3.interpolateViridis);

      // Define a gradient
      const gradient = legend
        .append("defs")
        .append("linearGradient")
        .attr("id", "color-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%")
        .attr("y1", "0%")
        .attr("y2", "0%");

      // Add gradient stops
      const numStops = 10; // Increase this number for smoother gradient
      for (let i = 0; i <= numStops; i++) {
        const t = i / numStops; // Calculate the position (0 to 1)
        gradient
          .append("stop")
          .attr("offset", `${t * 100}%`)
          .attr(
            "stop-color",
            colorScale(extent[0] + t * (extent[1] - extent[0]))
          ); // Interpolated color
      }

      // Draw the gradient rectangle
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", 20) // Positioning it below the min/max labels
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#color-gradient)");

      // Add min and max labels
      legend
        .append("text")
        .attr("x", 0)
        .attr("y", 15)
        .text(`Min: ${extent[0].toFixed(3)}`)
        .style("font-size", "12px");

      legend
        .append("text")
        .attr("x", legendWidth)
        .attr("y", 15)
        .attr("text-anchor", "end")
        .text(`Max: ${extent[1].toFixed(3)}`)
        .style("font-size", "12px");
    }
  } else {
    // Discrete legend
    const padding = 30;
    let cumulativeWidth = 0;
    const legend = svg.append("g").attr(
      "transform",
      `translate(${margin.left + colPadding / 2}, ${height - rowPadding / 1.5})` // Start legend at the leftmost point of the container
    );

    // Create legend items dynamically
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

  if (facetingRequiredX && facetingRequiredY) {
    // Apply faceting on both fac_x and fac_y
    uniqueFacX.forEach((facXValue, i) => {
      uniqueFacY.forEach((facYValue, j) => {
        const facetData = data.filter(
          (d) => d.fac_x === facXValue && d.fac_y === facYValue
        );

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
        const title = `${facXValue} / ${facYValue}`;
        const x_label =
          variables.mappingToLong[
          var_x as keyof typeof variables.mappingToLong
          ];
        const y_label =
          variables.mappingToLong[
          var_y as keyof typeof variables.mappingToLong
          ];
        drawPoints(
          facetGroup,
          facetData,
          xScale,
          yScale,
          x_axis,
          min_x_axis,
          max_x_axis,
          all_min_x_axis,
          all_max_x_axis,
          y_axis,
          min_y_axis,
          max_y_axis,
          all_min_y_axis,
          all_max_y_axis,
          plotHeight,
          plotWidth,
          var_x,
          var_y,
          getColor,
          discreteOrContinuous,
          globalColorOrder, // Pass the global color order here
          showMeanMedianX,
          showMeanMedianY,
          title,
          x_label,
          y_label
        );
      });
    });
  } else if (facetingRequiredX) {
    // Apply faceting on fac_x only
    uniqueFacX.forEach((facXValue, i) => {
      const facetData = data.filter((d) => d.fac_x === facXValue);
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

      const title = `${facXValue}`;
      const x_label =
        variables.mappingToLong[var_x as keyof typeof variables.mappingToLong];
      const y_label =
        variables.mappingToLong[var_y as keyof typeof variables.mappingToLong];
      drawPoints(
        facetGroup,
        facetData,
        xScale,
        yScale,
        x_axis,
        min_x_axis,
        max_x_axis,
        all_min_x_axis,
        all_max_x_axis,
        y_axis,
        min_y_axis,
        max_y_axis,
        all_min_y_axis,
        all_max_y_axis,
        plotHeight,
        plotWidth,
        var_x,
        var_y,
        getColor,
        discreteOrContinuous,
        globalColorOrder, // Pass the global color order here
        showMeanMedianX,
        showMeanMedianY,
        title,
        x_label,
        y_label
      );
    });
  } else if (facetingRequiredY) {
    // Apply faceting on fac_y only
    uniqueFacY.forEach((facYValue, j) => {
      const facetData = data.filter((d) => d.fac_y === facYValue);
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

      const title = `${facYValue}`;
      const x_label =
        variables.mappingToLong[var_x as keyof typeof variables.mappingToLong];
      const y_label =
        variables.mappingToLong[var_y as keyof typeof variables.mappingToLong];
      drawPoints(
        facetGroup,
        facetData,
        xScale,
        yScale,
        x_axis,
        min_x_axis,
        max_x_axis,
        all_min_x_axis,
        all_max_x_axis,
        y_axis,
        min_y_axis,
        max_y_axis,
        all_min_y_axis,
        all_max_y_axis,
        plotHeight,
        plotWidth,
        var_x,
        var_y,
        getColor,
        discreteOrContinuous,
        globalColorOrder, // Pass the global color order here
        showMeanMedianX,
        showMeanMedianY,
        title,
        x_label,
        y_label
      );
    });
  } else {
    const i = 0;
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
    const title = ``;
    const x_label =
      variables.mappingToLong[var_x as keyof typeof variables.mappingToLong];
    const y_label =
      variables.mappingToLong[var_y as keyof typeof variables.mappingToLong];
    drawPoints(
      facetGroup,
      data,
      xScale,
      yScale,
      x_axis,
      min_x_axis,
      max_x_axis,
      all_min_x_axis,
      all_max_x_axis,
      y_axis,
      min_y_axis,
      max_y_axis,
      all_min_y_axis,
      all_max_y_axis,
      plotHeight,
      plotWidth,
      var_x,
      var_y,
      getColor,
      discreteOrContinuous,
      globalColorOrder, // Pass the global color order here
      showMeanMedianX,
      showMeanMedianY,
      title,
      x_label,
      y_label
    );
  }
};
 */
