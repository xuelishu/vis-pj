<template>
  <div ref="container" class="area-chart-container">
    <div class="col col-left"></div>
    <div class="col divider" ref="axisContainer"></div>
    <div class="col col-right" ref="chartContainer">
      <svg ref="areaSvg"></svg>
    </div>
  </div>
</template>

<script>
import { defineComponent, onMounted, ref } from 'vue'
import * as d3 from 'd3';
import rawJson from '../../../server/data/time_count.json';
import { useStore } from 'vuex'


export default {
  name: 'D3AreaSmoothChart',
  props: {
    data: {
      type: Array,
      default: () => rawJson[0]?.All || []
    }
  },
  mounted() {
    this.drawChart(this.data);
  },
  methods: {
    drawChart(rawArray) {
      const parseTime = d3.utcParse('%Y-%m-%d %H:%M:%S');
      // 1. 标准化 & 过滤 & 排序
      const series = rawArray
        .map(d => {
          if (d.time != null && d.count != null) {
            return { date: parseTime(d.time), count: +d.count };
          }
          const [k, v] = Object.entries(d)[0];
          return { date: parseTime(k), count: +v };
        })
        .filter(d => d.date instanceof Date && !isNaN(d.count))
        .sort((a, b) => d3.ascending(a.date, b.date));
      const smoothed = series.map((d, i, arr) => {
        const start = Math.max(0, i - 15);
        const end = Math.min(arr.length, i + 15);
        const window = arr.slice(start, end);
        const avg = d3.mean(window, v => v.count);
        return { date: d.date, count: avg };
      });
      // 2. 时间范围 & 尺寸
      const startTime = parseTime('2020-04-06 00:00:00');
      const endTime = parseTime('2020-04-10 11:59:00');
      const axisContainer = this.$refs.axisContainer;
      const height = axisContainer.clientHeight;
      const chartContainer = this.$refs.chartContainer;
      const width = chartContainer.clientWidth;

      // 3. yScale：时间 → [0, height]
      const yScale = d3.scaleTime()
        .domain([startTime, endTime])
        .range([0, height]);

      // 4. 生成每小时刻度位置
      const allHours = d3.timeHour.range(
        startTime,
        d3.timeHour.offset(endTime, 1),
        1
      );

      // 5. 在 .divider 中插入 SVG 并画轴
      const axisSvg = d3.select(axisContainer)
        .append('svg')
        .classed('axis-svg', true)
        .attr('width', 20)
        .attr('height', height)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0);

      const axisG = axisSvg.append('g')
        .attr('transform', 'translate(0,0)')
        .call(d3.axisRight(yScale)
          .tickValues(allHours)
          .tickSize(6)
          .tickPadding(4)
          .tickFormat(d => {
            // 仅每 6 小时一个刻度显示文字
            if (d.getUTCHours() % 6 !== 0) return '';
            // 如果是当天 00:00，则同时拼上日期
            const timeStr = d3.utcFormat('%H:%M')(d);
            if (d.getUTCHours() === 0) {
              const dateStr = d3.utcFormat('%m-%d')(d);
              return `${dateStr} ${timeStr}`;
            }
            return timeStr;
          })
        )
        .call(g => g.select('.domain').remove());

      // 6. 为每个刻度分组（g.tick）设样式
      axisG.selectAll('g.tick')
        .each(function (d) {
          const g = d3.select(this);
          // 加粗当天 00:00 的刻度线
          g.select('line')
            .attr('stroke', '#000')
            .attr('stroke-width', d.getUTCHours() === 0 ? 2 : 1);
          // 竖排文本：旋转 -90°，并微调位置
          g.select('text')
            .attr('fill', '#000')
            .attr('font-size', '12px')
            .attr('transform', 'rotate(-90)')
            .attr('text-anchor', 'start')
            // 旋转后的坐标基于 (0,0)，需要向右下微调
            .attr('dx', '-0.5em')
            .attr('dy', '1em');
        });

      // 7. 流线图：xScale + area
      const xScale = d3.scaleLinear()
        .domain([0, d3.max(series, d => d.count)])
        .range([0, width]);

      const areaGen = d3.area()
        .curve(d3.curveBasis)
        .y(d => yScale(d.date))
        .x0(0)
        .x1(d => xScale(d.count));

      // 8. 绘制流线图
      const svg = d3.select(this.$refs.areaSvg)
        .attr('width', width)
        .attr('height', height);

      svg.append('path')
        .datum(smoothed)
        .attr('fill', 'lightblue')
        .attr('d', areaGen);
      const containerEl = this.$refs.container;
      const containerWidth = containerEl.clientWidth;
      const containerHeight = containerEl.clientHeight;

      const brush = d3.brushY()
        .extent([[0, 0], [containerWidth, containerHeight]])
        .on('end', (event) => {
          if (!event.selection) return;
          const [y0, y1] = event.selection;
          const t0 = yScale.invert(y0);
          const t1 = yScale.invert(y1);
          this.$store.dispatch('setTimeRange', { start: t0, end: t1 });
          this.$emit("nowtime",[t0,t1])
        });
      const overlay = d3.select(containerEl).append('svg')
        .attr('class', 'brush-overlay')
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)
        .style('pointer-events', 'all')
        .style('z-index', 3);

      overlay.append('g')
        .attr('class', 'brush')
        .call(brush);
    }
  }
};
</script>

<style scoped>
.area-chart-container {
  display: flex;
  width: 100%;
  height: calc(100% - 30px);
  position: relative;
}

.col {
  box-sizing: border-box;
}

.col-left {
  flex: 1;
}

/* 白线 + 刻度 SVG 容器 */
.divider {
  flex: 0 0 2px;
  background-color: #fff;
  position: relative;
  overflow: visible;
  /* 允许刻度/标签溢出 */
  z-index: 2;
  /* 刻度/标签在流线图之上 */
}

/* 流线图容器，z-index 更低 */
.col-right {
  flex: 1;
  position: relative;
  z-index: 1;
}

/* 允许 SVG 溢出 */
.axis-svg,
.col-right svg {
  overflow: visible;
}

.col-right svg {
  display: block;
  width: 100%;
  height: 100%;
}

.brush-overlay {
  overflow: visible;
  background: transparent;
  /* 不遮挡下层 */
}

.brush .selection {
  fill: rgba(0, 120, 215, 0.3);
  stroke: #0078d7;
}
</style>
