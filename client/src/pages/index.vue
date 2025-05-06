<template>
  <div class="layout">
    <div class="sidebar-left">
      <div class="top-bg">{{ formattedTime }}</div>
      <Timeline @nowtime="updateNowtime" />
    </div>
    <div class="main-content">
      <div class="top-bg">💡LightHouse of St.Himark</div>
      <svg ref="graph" class="graph-layer">
          <defs>
            <clipPath id="cutout" clipPathUnits="userSpaceOnUse">
              <rect x="0" y="0" :width="svgW" :height="svgH"/>
              <circle
                :cx="svgW/2"
                :cy="svgH/2"
                :r="R"
                fill="black"
                fill-rule="evenodd"
              />
            </clipPath>
          </defs>
          <g clip-path="url(#cutout)"></g>
        </svg>
      <div class="circle-card">
        <Map />
      </div>
    </div>
    <div class="sidebar-right">
      <div class="top-bg">
        <span class="count">Count：{{ messagesToShow.length }}</span>
        <label class="switch">
          <input type="checkbox" v-model="ignoreBlockList" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="messages-container">
        <Messages
          v-for="message in messagesToShow"
          :key="message.id"
          :message="message"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue';
import { useStore } from 'vuex';
import * as d3 from 'd3';
import Timeline from '~/components/Timeline.vue';
import Map from '~/components/Map.vue';
import Messages from '~/components/Messages.vue';
import { forceCircleBoundary } from '../composables/circleBoundaryForce';

const graph = ref<SVGSVGElement|null>(null);
const svgW  = ref(0);
const svgH  = ref(0);
const R = ref(0);
let linkSel: d3.Selection<SVGLineElement, any, any, any>;
let nodeSel: d3.Selection<SVGCircleElement, any, any, any>;
let g: d3.Selection<SVGGElement, unknown, any, any>;
let sim: d3.Simulation<any, any>;
let nodes: any[];
let links: any[];
const store = useStore<{ filterWordGraph: { nodes: any[]; links: any[] };rawData: Message[]; filterData: Message[]; blockList: string[] }>();
const graphData = computed(() => store.getters.filterWordGraph);

const ignoreBlockList = ref(false);
const blockList = computed<string[]>(() => store.getters.blockList);
  const messagesToShow = computed<Message[]>(() => {
  if (ignoreBlockList.value) {
    return store.getters.filterData.filter(
      (msg: Message) => !blockList.value.includes(msg.account)
    );
  }
  return store.getters.filterData;
});
function ticked() {
  linkSel
    .attr('x1', d => (d.source as any).x)
    .attr('y1', d => (d.source as any).y)
    .attr('x2', d => (d.target as any).x)
    .attr('y2', d => (d.target as any).y);

  nodeSel
    .attr('cx', d => {
      d.x = Math.max(d.r || 5, Math.min(svgW.value - (d.r || 5), d.x));
      return d.x;
    })
    .attr('cy', d => {
      const topGap = 30;
      d.y = Math.max(topGap + (d.r || 5), Math.min(svgH.value - (d.r || 5), d.y));
      return d.y;
    });
}
onMounted(async () => {
  const res = await fetch('http://127.0.0.1:5000/api/initial');
  const data: Message[] = await res.json();
  store.dispatch('initRawData', data);
});
// 新增：拿到 svg 容器、尺寸，初始化 D3 力导图
onMounted(async () => {
  // 等 Vue 完全渲染完 template
  await nextTick();
  if (graph.value) {
    svgW.value = graph.value.clientWidth;
    svgH.value = graph.value.clientHeight;
    const card = document.querySelector('.circle-card') as HTMLElement;
    R.value = card.clientWidth / 2;
    
    // D3 选择 <g> 容器
    g = d3.select(graph.value).select<SVGGElement>('g');
    nodes = graphData.value.nodes.map(n => ({ ...n, id: n.index }));
    links = graphData.value.links.map(l => ({ ...l, source: l.source, target: l.target }));

    // 先绑定 DOM
    linkSel = g.selectAll('line').data(links)
      .enter().append('line')
      .attr('stroke', '#999');
    nodeSel = g.selectAll('circle').data(nodes)
      .enter().append('circle')
      .attr('r', d => d.r || 5)
      .attr('fill', '#69b3a2');

    // 建力模拟
    sim =d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d:any) => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-30))
      .force('center',
           d3.forceCenter(svgW.value/2, svgH.value/2))
      .force('circleBound',
             forceCircleBoundary(R.value, svgW.value/2, svgH.value/2, 0.8))
      .on('tick', ticked);
  }
});
watch(graphData, ({ nodes: nds, links: lks }) => {
  // 清掉旧的节点和连线
  // 更新数据
  nodes = nds.map(n => ({ ...n, id: n.index }));
  links = lks.map(l => ({ ...l, source: l.source, target: l.target }));
  g.selectAll('circle, line').remove();

  // 重新绑定 DOM
  linkSel = g.selectAll('line')
    .data(links)
    .enter().append('line')
      .attr('stroke', '#999');

  nodeSel = g.selectAll('circle')
    .data(nodes)
    .enter().append('circle')
      .attr('r', d => d.r || 5)
      .attr('fill', '#69b3a2');

  // 重启力模拟
  sim.nodes(nodes as any);
  (sim.force('link') as any).links(links);
  sim.alpha(1).restart();
});
const nowtime = ref<[string, string] | null>(null);

// 格式化时间范围
const formattedTime = computed(() => {
  if (!nowtime.value || nowtime.value.length === 0) {
    return 'Please select timerange~';
  }
  const [t0, t1] = nowtime.value;
  const formatTime = (time: string | number) => {
    const date = new Date(time);
    const month = date.getMonth() + 1; // 月份从0开始，需加1
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    // 返回格式化的时间字符串：月日 时:分:秒
    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  };

  return `${formatTime(t0)} ~ ${formatTime(t1)}`;
});

// 更新时间范围
function updateNowtime(timeRange: [string, string]) {
  nowtime.value = timeRange;
}
</script>
<style scoped>
.layout {
  display: flex;
  width: 100%;
  height: 100vh;
}

.sidebar-left,
.sidebar-right {
  flex: 0 0 20%;
  height: calc(100% -30px);
  padding: 0px;
  box-sizing: border-box;
  background-color: white;
}

.sidebar-right {
  overflow-y: auto;
}

.main-content {
  position: relative;
  /* 关键：为绝对定位的圆卡做参考 */
  flex: 0 0 60%;
  padding: 0;
  /* 卡片要铺满，无需内边距 */
  overflow: hidden;
  /* 如果 map-bg 溢出可以隐藏 */
  background-color: white;
}

.messages-container {
  height: calc(100% - 30px);
  /* 减去顶部的 20px */
  overflow-y: auto;
  /* 允许滚动 */
  padding: 0 0px;
  margin: 0;
  /* 适当的内边距 */
}

.map-bg {
  width: 100%;
  height: calc(100% - 30px);
  object-fit: cover;
  /* 如果是 <img> 或者地图库支持的话 */
  position: absolute;
  top: 30px;
  left: 0;
  z-index: 0;
}

/* 中央圆形卡片 */
.circle-card {
  position: absolute;
  top: 50%;
  left: 50%;
  width: min(80%, 90vh);
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-color: #fff;
  box-shadow: 0 0px 40px rgb(86, 80, 80);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}


.circle-card>* {
  width: 100%;
  height: calc(100% - 30px);
}

.sidebar-left .top-bg,
.main-content .top-bg {
  display: flex;
  width: 100%;
  height: 30px;
  justify-content: center;
  text-align: center;
  align-items: center;
  background-color: silver;
}
.sidebar-right .top-bg {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  height: 30px;
  background-color: silver;
}
.count {
  text-align: left;
}

/* Toggle Switch 样式 */
.switch {
  position: absolute;
  display: inline-block;
  left: 96.8%; 
  width: 40px;   /* 开关整体宽度 */
  height: 20px;  /* 开关整体高度 */
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ccc;
  transition: background-color 0.3s;
  border-radius: 20px;
}
.slider::before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: #fff;
  transition: transform 0.3s;
  border-radius: 50%;
}
.switch input:checked + .slider {
  background-color: #4caf50;
}
.switch input:checked + .slider::before {
  transform: translateX(20px);
}
.graph-layer {
  position: absolute;
  top: 30px;
  left: 0;
  width: 100%;
  height: calc(100% - 30px);
  z-index: 2;
  pointer-events: none;
}
</style>
