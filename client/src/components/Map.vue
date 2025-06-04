<template>
  <div class="map-container">
    <svg
      ref="svg"
      :width="width"
      :height="height"
      class="map-svg"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- 地图轮廓 + 热力图填充 + 区域文字 -->
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

      <!-- 调用 DonutChart 组件，传入必需的 props -->
      <donut-chart
        :pieData="pieData"
        :colorScale="colorScale"
        :innerRadius="innerRadius"
        :outerRadius="outerRadius"
        :centerX="width / 2"
        :centerY="height / 2"
      />

      <!-- 热力图图例 -->
      <defs>
        <linearGradient id="heatLegendGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="white" />
          <stop offset="100%" stop-color="red" />
        </linearGradient>
      </defs>
      <g class="heat-legend" :transform="`translate(20, ${height - 80})`">
        <rect
          x="0"
          y="0"
          :width="100"
          height="10"
          fill="url(#heatLegendGradient)"
          stroke="black"
          stroke-width="0.3"
          class="heat-legend-bar"
        />
        <text x="0" y="25" text-anchor="start">0</text>
        <text x="100" y="25" text-anchor="end">1</text>
      </g>
    </svg>
  </div>
</template>

<script lang="ts">
import * as d3 from 'd3';
import { defineComponent } from 'vue';
import geojsonData from '../../../server/data/StHimark.json';

export default defineComponent({
  name: 'Map',
  data() {
    return {
      geojson: geojsonData,
      width: 550,
      height: 550,
      projection: null as d3.GeoProjection | null,
      pathGenerator: null as d3.GeoPath<any, any> | null,
      // 饼图所需的数据
    //   ratio_data: { 主题1: 0.1, 主题2: 0.85, 主题3: 0.05 },
    //   // 颜色比例尺（直接在父组件里定义，让 DonutChart 复用）
    colorScale: d3.scaleOrdinal(d3.schemePastel1),
      selectedNbrhood: null as string | null,
    };
  },
  computed: {
    /*************** 地图热力图相关 ***************/
    heatmapRaw(): Message[] {
      return this.$store.getters.filterDataForHeatmap;
    },
    heatmapByLocation(): Record<string, number> {
      const tmp = this.heatmapRaw.reduce((acc, msg) => {
        const loc = msg.location;
        if (!acc[loc]) acc[loc] = { sum: 0, count: 0 };
        acc[loc].sum += msg.emotion;
        acc[loc].count += 1;
        return acc;
      }, {} as Record<string, { sum: number; count: number }>);

      const scores: Record<string, number> = {};
      Object.entries(tmp).forEach(([loc, { sum, count }]) => {
        const avg = sum / count;
        scores[loc] = Math.exp(avg) * count;
      });
      return scores;
    },
    heatmapValues(): number[] {
      return Object.values(this.heatmapByLocation);
    },
    heatmapScale(): d3.ScaleLinear<string, string> {
      const vals = this.heatmapValues;
      const min = d3.min(vals) ?? 0;
      const max = d3.max(vals) ?? 1;
      return d3.scaleLinear<string, string>()
        .domain([min, max])
        .range(['white', 'red']);
    },

    /*************** 饼图（DonutChart）相关 ***************/
    outerRadius(): number {
      return Math.min(1300, 1300) / 2; // 本例固定写死，也是 (width, height) 中较小的值 / 2
    },
    innerRadius(): number {
      return this.outerRadius * 0.85;
    },
    // pieData(): d3.PieArcDatum<{ key: string; value: number }>[] {
    //   const entries = Object.entries(this.ratio_data).map(([key, value]) => ({ key, value }));
    //   return d3.pie<{ key: string; value: number }>()
    //     .value((d) => d.value)
    //     .sort(null)(entries);
    // },
  },
  methods: {
    /*************** 地图部分的方法 ***************/
    heatmapColor(nbr: string): string {
      const val = this.heatmapByLocation[nbr] || 0;
      return this.heatmapScale(val);
    },
    initProjection() {
      this.projection = d3.geoMercator()
        .fitSize([this.width, this.height], this.geojson);
      this.pathGenerator = d3.geoPath(this.projection);
    },
    centroid(feature: any): [number, number] {
      return (this.pathGenerator as d3.GeoPath<any, any>)(feature) 
        ? (this.pathGenerator as any).centroid(feature)
        : [0, 0];
    },
    onFeatureClick(nbr: string) {
      if (this.selectedNbrhood === nbr) {
        this.selectedNbrhood = null;
        this.$store.dispatch('setLocation', '');
      } else {
        this.selectedNbrhood = nbr;
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
  },
});
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

.feature-selected .feature-path {
  stroke: orange !important;
  stroke-width: 2 !important;
  filter: drop-shadow(0 0 6px orange);
}

.heat-legend-bar {
  /* 如果需要可以在这里单独写热力图图例的样式 */
}

.heat-legend text {
  font-size: 12px;
  fill: #000;
}
</style>
