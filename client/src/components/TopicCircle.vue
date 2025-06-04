<template>
  <div class="topic-circle-container">
    <div ref="chartRef" class="topic-circle-chart"></div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch, nextTick, onBeforeUnmount, computed } from 'vue';
import { useStore } from 'vuex';
import * as echarts from 'echarts';

export default defineComponent({
  name: 'TopicCircle',
  setup() {
    const store = useStore();
    const chartRef = ref<HTMLDivElement | null>(null);
    let chartInstance: echarts.ECharts | null = null;

    // 从 Vuex 中获取外环 (topic) 数据和内环 (special words) 数据
    const topicsData = computed(() => store.state.topicsPieChart as Array<{ name: string; value: number }>);
    const specialWordsData = computed(() => store.state.wordsPieChart as Array<{ name: string; value: number }>);
const initChart = () => {
  if (chartRef.value) {
    chartInstance = echarts.init(chartRef.value);

   let lastTopicClicked: string | null = null;
     let lastWordClicked: string | null = null;

    chartInstance.on('click', (params) => {
      const { seriesName, name } = params as { seriesName: string; name: string };

      if (seriesName === 'Topics') {
 // 如果和上次点击的是同一个 topic，则清空；否则按 name 过滤
 if (lastTopicClicked === name) {
   store.dispatch('setPieTopicFilter', '');
   lastTopicClicked = null;
 } else {
   store.dispatch('setPieTopicFilter', name);
   lastTopicClicked = name;
 }
 // 每次点击 topic，都要把 word 的“记忆”清掉，否则两个筛选会互相干扰
 lastWordClicked = null;
      }
      else if (seriesName === 'Special Words') {
 if (lastWordClicked === name) {
   store.dispatch('setPieWordFilter', '');
   lastWordClicked = null;
 } else {
   store.dispatch('setPieWordFilter', name);
   lastWordClicked = name;
 }
 // 每次点击 word，都要把 topic 的“记忆”清掉
 lastTopicClicked = null;
      }
    });

    updateChart(); // 首次渲染
  }
};


    // 根据最新数据更新两个圆环的配置
    const updateChart = () => {
      if (!chartInstance) return;

      // 组合 ECharts 的 option
      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)'
        },
        legend: {
          bottom: 0,
          left: 'center'
        },
        series: [
          {
            name: 'Topics',
            type: 'pie',
            // 外环：从 60% 到 80%
            radius: ['60%', '80%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            label: {
              show: false,
            },
            labelLine: {
              show: false,
            },
            color: [
  '#A65F5F',
  '#F1FAEE',
  '#1D3557',
  '#457B9D',
  '#A8DADC',
  '#F4D35E',
  '#FFBE0B',
  '#264653',
  '#2A9D8F',
  '#C0A080'
],
            data: topicsData.value.map(item => ({
              name: item.name,
              value: item.value
            })),
            // 可以加点击事件高亮或筛选
            emphasis: {
              scale: true,
              scaleSize: 8,
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          },
          {
            name: 'Special Words',
            type: 'pie',
            // 内环：从 30% 到 50%
            radius: ['30%', '50%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            label: {
              show: false,
            },
            labelLine: {
              show: false,
            },
            data: specialWordsData.value.map(item => ({
              name: item.name,
              value: item.value
            })),
            emphasis: {
              scale: true,
              scaleSize: 8,
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      };

      chartInstance.setOption(option);
    };

    // 监听数据变化，自动更新图表
    watch([topicsData, specialWordsData], () => {
      nextTick(() => {
        updateChart();
      });
    }, { deep: true });

    // 监听容器尺寸变化时自动 resize
    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance) {
        chartInstance.resize();
      }
    });

    onMounted(() => {
      initChart();
      // 绑定 resize 监听
      if (chartRef.value) {
        resizeObserver.observe(chartRef.value);
      }
    });

    onBeforeUnmount(() => {
      if (chartInstance) {
        chartInstance.dispose();
        chartInstance = null;
      }
      if (chartRef.value) {
        resizeObserver.unobserve(chartRef.value);
      }
    });

    return {
      chartRef
    };
  }
});
</script>

<style scoped>
.topic-circle-container {
  display: flex;
  justify-content: center;
  align-items: center;
  /* 大小可按需调整 */
  width: 100%;
  height: 100%;
}

.topic-circle-chart {
  width: 100%;
  height: 100%;
}
</style>
