<template>
  <div class="layout">
    <!-- 左侧栏 -->
    <div class="sidebar-left">
      <!-- 顶部：时间 + 筛选按钮 -->
      <div class="top-bg" style="position: relative; display: flex; align-items: center; justify-content: center;">
        <!-- 显示已选时间 -->
        <span>{{ formattedTime }}</span>

        <!-- 筛选按钮及下拉 -->
        <div class="filter-dropdown" style="margin-left: 10px; position: relative;">
          <!-- 按钮，label 用一级选项 -->
          <button @click="toggleDropdown"
            style="padding: 2px 8px; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">
            {{ firstLabel }}
            <span style="margin-left: 4px;">▾</span>
          </button>

          <!-- 下拉菜单 -->
          <div v-if="dropdownOpen" class="dropdown-menu"
            style="position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px 8px 8px 4px; z-index: 10; width: 160px;">
            <!-- 一级单选 -->
            <div v-for="option in firstOptions" :key="option"
              style="display: flex; align-items: center; margin-bottom: 4px; padding: 0;">
              <input type="radio" :id="`first-${option}`" :value="option" v-model="selectedFirst"
                @change="onFirstChange" name="firstGroup" style="margin: 0;" />
              <label :for="`first-${option}`" style="margin-left: 4px;">{{ option }}</label>
            </div>
            <div v-if="selectedFirst !== 'ALL'" style="margin-top: 8px; 
         border-top: 1px solid #eee; 
         padding-top: 8px;
         max-height: 150px;       /* 限制高度 150px */
         overflow-y: auto;       /* 超过时显示竖向滚动条 */
         -webkit-overflow-scrolling: touch; /* 移动端优化，可选 */
        ">
              <!-- 二级多选（当 selectedFirst 不是 ALL 时才显示） -->
              <div v-for="subOption in secondOptionsMap[selectedFirst]" :key="subOption"
                style="display: flex; align-items: center; margin-bottom: 4px; padding: 0;">
                <input type="checkbox" :id="`second-${subOption}`" :value="subOption" v-model="selectedSecond"
                  style="margin: 0;" />
                <label :for="`second-${subOption}`" style="margin-left: 4px;">{{ subOption }}</label>
              </div>

              <!-- 确定按钮 -->
              <div style="text-align: right; margin-top: 8px;">
                <button @click="applyFilter"
                  style="padding: 2px 6px; background-color: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
          <input type="text" v-model="searchInput" placeholder="Filter by..." class="search-input"
            style="margin-left: 25px;" />
          <button class="btn-check" @click="applySearch" style="margin-left: 15px;">
            √
          </button>
          <button class="btn-add" @click="addSomething" style="margin-left: 15px;">
            Add
          </button>
          <label class="switch">
            <input type="checkbox" v-model="ignoreBlockList" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="messages-container">
          <Messages v-for="message in messagesToShow" :key="message.id" :message="message" />
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
import BackCircle from '~/components/BackCircle.vue';

const store = useStore<{ rawData: Message[]; filterData: Message[]; blockList: string[] }>();
const ignoreBlockList = ref(false);
const blockList = computed<string[]>(() => store.getters.blockList);
const searchInput = ref('');
const appliedSearch = ref('');
const messagesToShow = computed<Message[]>(() => {
  // ① 从 Vuex 拿到“基础要展示”的数据（filterData）
  let list: Message[] = store.getters.filterData;

  // ② 如果 ignoreBlockList 为 true，就先过滤掉黑名单账户的消息
  if (ignoreBlockList.value) {
    list = list.filter(
      (msg: Message) => !blockList.value.includes(msg.account)
    );
  }
  // ③ 再根据 appliedSearch 是否有值，做「消息内容包含字符串（半匹配）」的筛选
  if (appliedSearch.value && appliedSearch.value.trim() !== '') {
    const keyword = appliedSearch.value.trim().toLowerCase();
    list = list.filter((msg: Message) => {
      if (typeof msg.message !== 'string') {
        return false;
      }
      return msg.message.toLowerCase().includes(keyword);
    });
  }

  return list;
});

function applySearch() {
  appliedSearch.value = searchInput.value;
  // 由于 messagesToShow 是 computed，会立刻重新计算并触发模板重新渲染
}

// —— 新增：示例性的“Add” 按钮逻辑 —— //
function addSomething() {
  // 你可以在这里做“把 searchInput.value 加入到某个列表”之类的事
  // 例如把关键字放到 Vuex 里，或者干脆加到黑名单里：
  if (searchInput.value.trim() !== '') {
    store.dispatch('addToMyList', searchInput.value.trim());
    // 然后清空搜索框
    searchInput.value = '';
  }
}
const firstOptions = ['ALL', 'REGION', 'TOPIC', 'WORDS'] as const;

// 二级选项占位（示例里随便写几个词），按一级分类
const secondOptionsMap: Record<string, string[]> = {
  REGION: ['Palace Hills',
    'Northwest',
    'Old Town',
    'Safe Town',
    'Southwest',
    'Downtown',
    'Wilson Forest',
    'Scenic Vista',
    'Broadview',
    'Chapparal',
    'Terrapin Springs',
    'Pepper Mill',
    'Cheddarford',
    'Easton',
    'Weston',
    'Southton',
    'Oak Willow',
    'East Parton',
    'West Parton'],      // 举例
  TOPIC: ['Math', 'Science', 'History', 'Art'],  // 举例
  WORDS: ['Hello', 'World', 'Vue', 'Timeline'],     // 举例
  // ALL 没有二级选项，不需要写
};

// 当前是否展开下拉
const dropdownOpen = ref(false);

// 当前选中的一级选项，默认为 'ALL'
const selectedFirst = ref<'ALL' | 'REGION' | 'TOPIC' | 'WORDS'>('ALL');

// 当前选中的二级选项数组
const selectedSecond = ref<string[]>([]);

// 计算属性：按钮上要显示的 label，就用一级选中值
const firstLabel = computed(() => selectedFirst.value);

// 最终传给 Timeline 的数组：如果选的是 ALL，就传 ['All']；否则传 selectedSecond
const filterToTimeline = computed<string[]>(() => {
  if (selectedFirst.value === 'ALL') {
    return ['All'];
  } else {
    // 如果二级没选任何，就可以返回空数组，也可根据需求默认不传
    return selectedSecond.value.slice();
  }
});

// 切换下拉开关
function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
}

// 当一级选项变化时，要清空二级选中的内容
function onFirstChange() {
  if (selectedFirst.value === 'ALL') {
    selectedSecond.value = [];
  } else {
    // 初次选非 ALL 时，可以把 selectedSecond 置空，用户自行勾选
    selectedSecond.value = [];
  }
}

// 点击“Apply”后：关闭下拉
function applyFilter() {
  // 无论 ALL 还是别的，filterToTimeline 会自动更新
  dropdownOpen.value = false;
}


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
  align-items: center;
  padding: 0 10px;
  height: 30px;
  background-color: silver;

  /* 不用 space-between，否则会把最右边 switch 拉到最右 */
  justify-content: flex-start;
}

.count {
  text-align: left;
}

/* Toggle Switch 样式 */
.switch {
  position: absolute;
  display: inline-block;
  left: 96.8%;
  width: 40px;
  /* 开关整体宽度 */
  height: 20px;
  /* 开关整体高度 */
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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

.switch input:checked+.slider {
  background-color: #4caf50;
}

.switch input:checked+.slider::before {
  transform: translateX(20px);
}

.search-input {
  width: 120px;
  height: 20px;
  margin: 0 8px;
  padding: 2px 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.btn-check .btn-add {
  width: 24px;
  height: 24px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 24px;
}

.btn-check:hover {
  color: #fff;
}

.btn-add:hover {
  color: #fff;
}
</style>
