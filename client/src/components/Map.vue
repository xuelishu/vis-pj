<template>
  <div class="map-container">
    <svg ref="svg" :width="width" :height="height" class="map-svg" :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet">
      <g class="features" ref="featuresGroup">
        <g
        v-for="feature in geojson.features"
        :key="feature.properties.Id"
        :id="`group-${feature.properties.Nbrhood}`"
        class="feature-group"
        @click="onFeatureClick(feature.properties.Nbrhood)"
        :class="{ 'feature-selected': feature.properties.Nbrhood === selectedNbrhood }"
      >
        <path
          :d="pathGenerator(feature)"
          class="feature-path"
          :style="{ fill: heatmapColor(feature.properties.Nbrhood) }"
        />
        <text
          :x="centroid(feature)[0]"
          :y="centroid(feature)[1]"
          class="feature-label"
          text-anchor="middle"
          alignment-baseline="middle"
        >
          {{ feature.properties.Nbrhood }}
        </text>
      </g>
      </g>
      <g class="donut-group" :transform="`translate(${width / 2},${height / 2})`">
        <path v-for="(d, i) in pieData" :key="i" :d="arcGenerator(d)" :fill="colorScale(i)" class="donut-path" />
      </g>
      <g class="donut-labels" :transform="`translate(${width / 2},${height / 2})`">
        <text v-for="(d, i) in pieData" :key="'label-' + i" :transform="`
                   translate(${labelPos(d).x},${labelPos(d).y})
                   rotate(${labelAngle(d)})
                 `" text-anchor="middle" alignment-baseline="middle" class="donut-label">
          {{ d.data.key }}
        </text>
      </g>
      <defs>
        <linearGradient id="heatLegendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="white" />
          <stop offset="100%" stop-color="red" />
        </linearGradient>
      </defs>
      <g class="heat-legend" :transform="`translate(110, ${height - 180})`">
        <rect x="0" y="0" :width="100" height="10" fill="url(#heatLegendGradient)" stroke="black" stroke-width="0.3"
          class="heat-legend-bar" />
        <text x="0" y="25" text-anchor="start">0</text>
        <text x="100" y="25" text-anchor="end">1</text>
      </g>
    </svg>
  </div>
</template>


<script lang="ts">
import * as d3 from 'd3';
import geojsonData from '../../../server/data/StHimark.json';

export default {
  name: 'Map',
  data() {
    return {
      geojson: geojsonData,
      width: 950,
      height: 950,
      projection: null,
      pathGenerator: null,
      ratio_data: { 主题1: 0.1, 主题2: 0.85, 主题3: 0.05 },
      colorScale: d3.scaleOrdinal(d3.schemePastel1),
      selectedNbrhood: null as string | null
    };
  },
  computed: {
     heatmapRaw(): Message[] {
return this.$store.getters.filterDataForHeatmap;
 },
 // 1) 按 location 分组，然后把每条消息的 emotion 累加
 heatmapByLocation(): Record<string, number> {
  // ① 先把每个地区的 sum、count 收集起来
  const tmp = this.heatmapRaw.reduce((acc, msg) => {
    const loc = msg.location;
    if (!acc[loc]) acc[loc] = { sum: 0, count: 0 };
    acc[loc].sum   += msg.emotion;
    acc[loc].count += 1;
    return acc;
  }, {} as Record<string, { sum: number; count: number }>);

  // ② 再转成最终分数：exp(平均值) × 消息数
  const scores: Record<string, number> = {};
  Object.entries(tmp).forEach(([loc, { sum, count }]) => {
    const avg = sum / count;                // 求均值
    scores[loc] = Math.exp(avg) * count;    // exp(均值) × N
  });

  return scores;                            // 结果仍是 { 地区: 分数 }
},
 // 2) 拿出所有区域的总 emotion，用来给 color scale 定义 domain
 heatmapValues(): number[] {
return Object.values(this.heatmapByLocation);
 },
 // 3) 构造线性颜色刻度（从白到红）
 heatmapScale(): d3.ScaleLinear<string, string> {
const vals = this.heatmapValues;
const min = d3.min(vals) ?? 0;
const max = d3.max(vals) ?? 1;
return d3.scaleLinear<string>()
  .domain([min, max])
  .range(['white', 'red']);
 },
    outerRadius() {
      return Math.min(1300, 1300) / 2;
    },
    innerRadius() {
      return this.outerRadius * 0.85;
    },
    // 4) 把 ratio_data 转成 pie() 需要的数组
    pieData() {
      // pie() 期望 [{key, value}, …]
      const entries = Object.entries(this.ratio_data).map(([key, value]) => ({ key, value }));
      return d3.pie()
        .value(d => d.value)
        .sort(null)(entries);
    }
  },
  methods: {
     heatmapColor(nbr: string): string {
   const val = this.heatmapByLocation[nbr] || 0;
   return this.heatmapScale(val);
 },
    initProjection() {
      this.projection = d3.geoMercator()
        .fitSize([this.width, this.height], this.geojson);
      this.pathGenerator = d3.geoPath(this.projection);
    },
    centroid(feature) {
      return this.pathGenerator.centroid(feature);
    },
    arcGenerator(d) {
      return d3.arc()
        .innerRadius(this.innerRadius)
        .outerRadius(this.outerRadius)(d);
    },
    labelPos(d) {
      const mid = (d.startAngle + d.endAngle) / 2;
      const r = this.innerRadius + 30;
      const x = Math.cos(mid - Math.PI / 2) * r;
      const y = Math.sin(mid - Math.PI / 2) * r;
      return { x, y };
    },
    labelAngle(d) {
      const mid = (d.startAngle + d.endAngle) / 2;
      return (mid * 180 / Math.PI);
    },
    onFeatureClick(nbr: string) {
      // 如果重复点击同一个，就清空选中并重置 filter
      if (this.selectedNbrhood === nbr) {
        this.selectedNbrhood = null;
        // 取消地区过滤：传 '' 或 null，取决于你 store 里怎么处理
        this.$store.dispatch('setLocation', '');
      } else {
        this.selectedNbrhood = nbr;
        // 设置地区过滤
        this.$store.dispatch('setLocation', nbr);
        this.$nextTick(() => {
    const grp = document.getElementById(`group-${nbr}`);
    if (grp && grp.parentNode) {
      grp.parentNode.appendChild(grp);
    }
       });
      }
    },
  },
  created() {
    this.initProjection();
  }
};
</script>

<style scoped>
.map-container {
  width: 100%;
  padding: 0%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
}

.map-svg {
  position: relative;
  display: block;
  background: white;
  overflow: visible;
  z-index: 0;
}

.donut-svg {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  pointer-events: none;
}

.feature-path {
  fill: #f8f8f8;
  stroke: #333;
  stroke-width: 1.5;
}

.feature-label {
  font-size: 11px;
  fill: #000;
  pointer-events: none;
  font-family: Arial, Helvetica, sans-serif;
}

.donut-label {
  font-size: 18px;
  fill: #333;
  pointer-events: none;

}

.feature-selected .feature-path{
  stroke: orange !important;
  stroke-width: 2 !important;
  filter: drop-shadow(0 0 6px orange);
}
</style>
