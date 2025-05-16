<template>
  <div class="layout">
    <div class="sidebar-left">
      <div class="top-bg">{{ formattedTime }}</div>
      <Timeline @nowtime="updateNowtime" />
    </div>
    <div class="main-content">
      <div class="top-bg">💡LightHouse of St.Himark</div>
      <BackCircle class="map-bg" />
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
import { computed, ref, onMounted } from 'vue';
import { useStore } from 'vuex';
import Timeline from '~/components/Timeline.vue';
import Map from '~/components/Map.vue';
import Messages from '~/components/Messages.vue';

const store = useStore<{ rawData: Message[]; filterData: Message[]; blockList: string[] }>();
const ignoreBlockList = ref(false);
const blockList = computed<string[]>(() => store.getters.blockList);
  const messagesToShow = computed<Message[]>(() => {
  // 如果开关打开，就过滤掉 blockList 里的用户消息
  if (ignoreBlockList.value) {
    return store.getters.filterData.filter(
      (msg: Message) => !blockList.value.includes(msg.account)
    );
  }
  return store.getters.filterData;
});
onMounted(async () => {
  const res = await fetch('http://127.0.0.1:5000/api/initial');
  const data: Message[] = await res.json();
  store.dispatch('initRawData', data);
});

// 从 Vuex 获取过滤后的数据
const filterData = computed(() => store.getters.filterData);

// 使用 ref 来保存选中的时间范围
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
  /* 宽度你可以根据设计自己调，这里示例用容器宽度的 80%，高度又限制为 80% 的视口高度 */
  width: min(80%, 90vh);
  aspect-ratio: 1 / 1;
  /* 保持宽高比 1:1 */
  transform: translate(-50%, -50%);
  border-radius: 50%;
  /* 变成圆形 */
  background-color: #fff;
  box-shadow: 0 0px 40px rgb(86, 80, 80);
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* 内部组件超出时隐藏 */
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
</style>
