<template>
  <div ref="chartRef" style="width: 100%; height: 100%;"></div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch, computed } from "vue";
import { useStore } from "vuex";
import * as echarts from "echarts";
import "echarts-wordcloud"; // 确保项目中已安装并引入 wordCloud 扩展

export default defineComponent({
  name: "WordCloud",
  // 声明向父组件抛出的事件名，这里用 kebab-case 约定 "word-click"
  emits: ["word-click"],
  setup(_, { emit }) {
    const chartRef = ref<HTMLDivElement | null>(null);
    let chartInstance: echarts.ECharts | null = null;
    const store = useStore();

    // 从 Vuex Getter 里拿到词云所需的数据：[{ name, value }, …]
    const wordCloudData = computed(() =>
      store.getters.wordCloudData as Array<{ name: string; value: number }>
    );
    const minSentiment = computed(() => {
  const arr = wordCloudData.value;
  if (arr.length === 0) return 0;
  return Math.min(...arr.map((item) => item.sentiment));
});
const maxSentiment = computed(() => {
  const arr = wordCloudData.value;
  if (arr.length === 0) return 0;
  return Math.max(...arr.map((item) => item.sentiment));
});

    // 初始化图表
    const initChart = () => {
      if (!chartRef.value) return;
      chartInstance = echarts.init(chartRef.value);

      const option: echarts.EChartsOption = {
                tooltip: {
          show: true,
          formatter: (params: any) => {
            // params.name 是词，params.value 是词频
            return `${params.name}: ${params.value}`;
          },
        },
        series: [
          {
            type: "wordCloud",
            gridSize: 2,
            rotationRange: [0, 0],    // 先设为 [0,0]，让 rotation 函数完全控制方向
            rotationStep: 0,          // 不按固定步长计算，交给 rotation 回调
            rotation: () => {
              const angles = [0, 90, 270];
              return angles[Math.floor(Math.random() * angles.length)];
            },
            sizeRange: [20, 180],
            shape: "circle",
            width: chartRef.value.clientWidth,
            height: chartRef.value.clientHeight,
            textStyle: {
              fontFamily: "sans-serif",
              fontWeight: "bold",
              // 随机颜色
            },
            data: [], 
                        emphasis: {
              focus: "self", 
              textStyle: {
                shadowBlur: 10,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
          },
        ],
      };

      chartInstance.setOption(option);

      // 注册点击事件，当点击词云中的某个词时，把词的 name 发给父组件
      chartInstance.on("click", (params) => {
        // 确保点击的是词云系列
        if (params.seriesType === "wordCloud" && params.name) {
          emit("word-click", params.name);
        }
      });
    };

watch(
      wordCloudData,
      (newData) => {
        if (!chartInstance) return;

 // 拿到当前的最小／最大 sentiment
 const min = minSentiment.value;
 const max = maxSentiment.value;

 // 把每一条都做一个映射：加一个 textStyle: { color: 'rgb(...)' }
 const processed = newData.map((d) => {
   // 归一化到 [0,1]
   let norm = 0.5;
   if (max > min) {
     norm = (d.sentiment - min) / (max - min);
   }
   // 红(0)→白(0.5)→绿(1)
let color = "";
if (norm <= 0.5) {
  // [0,0.5]：红 (255,0,0) → 黄 (255,255,0)
  const t = norm / 0.5;       // 0→0 ; 0.5→1
  const r = 255;              // 一直是 255
  const g = Math.round(255 * t); // 0→255
  const b = 0;                // 一直是 0
  color = `rgb(${r}, ${g}, ${b})`;
} else {
  // (0.5,1]：黄 (255,255,0) → 绿 (0,255,0)
  const t = (norm - 0.5) / 0.5; // 0.5→0 ; 1→1
  const r = Math.round(255 * (1 - t)); // 255→0
  const g = 255;              // 一直是 255
  const b = 0;                // 一直是 0
  color = `rgb(${r}, ${g}, ${b})`;
}

   return {
     name: d.name,
     value: d.value,
     textStyle: { color },
   };
 });

 chartInstance.setOption({
   series: [
     {
       data: processed,
     },
   ],
 });
      },
      { immediate: true }
    );

    onMounted(() => {
      initChart();
      // 窗口大小变化时让图表自适应
      window.addEventListener("resize", () => {
        chartInstance && chartInstance.resize();
      });
    });

    return {
      chartRef,
    };
  },
});
</script>

<style scoped>
/* 根据需求微调容器样式 */
</style>
