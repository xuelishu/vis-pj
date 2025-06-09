<template>
  <div class="layout">
    <!-- 左侧栏 -->
    <div class="sidebar-left">
      <!-- 顶部：时间 + 筛选按钮 -->
      <div
        class="top-bg"
        style="position: relative; display: flex; align-items: center; justify-content: center;"
      >
        <!-- 显示已选时间 -->
        <span>{{ formattedTime }}</span>

        <!-- 筛选按钮及下拉 -->
        <div class="filter-dropdown" style="margin-left: 10px; position: relative;">
          <!-- 按钮，label 用一级选项 -->
          <button
            @click="toggleDropdown"
            style="padding: 2px 8px; background-color: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;"
          >
            {{ firstLabel }}
            <span style="margin-left: 4px;">▾</span>
          </button>

          <!-- 下拉菜单 -->
          <div
            v-if="dropdownOpen"
            class="dropdown-menu"
            style="position: absolute; top: 100%; left: 0; background: white; border: 1px solid #ccc; border-radius: 4px; padding: 8px 8px 8px 4px; z-index: 10; width: 160px;"
          >
            <!-- 一级单选 -->
            <div
              v-for="option in firstOptions"
              :key="option"
              style="display: flex; align-items: center; height: 20px; margin-bottom: 4px; padding: 0;"
            >
              <input
                type="radio"
                :id="`first-${option}`"
                :value="option"
                v-model="selectedFirst"
                @change="onFirstChange"
                name="firstGroup"
                style="margin: 0;height: 100%;"
              />
              <label :for="`first-${option}`" style="margin-left: 4px;line-height: 20px;">{{ option }}</label>
            </div>
            <div
              v-if="selectedFirst !== 'ALL'"
              style="margin-top: 8px;
                     border-top: 1px solid #eee;
                     padding-top: 8px;
                     max-height: 150px;
                     overflow-y: auto;
                     -webkit-overflow-scrolling: touch;"
            >
              <!-- 二级多选（当 selectedFirst 不是 ALL 时才显示） -->
              <div
                v-for="subOption in secondOptionsMap[selectedFirst]"
                :key="subOption"
                style="display: flex; align-items: center; margin-bottom: 4px; padding: 0;"
              >
                <input
                  type="checkbox"
                  :id="`second-${subOption}`"
                  :value="subOption"
                  v-model="selectedSecond"
                  style="margin: 0;"
                />
                <label :for="`second-${subOption}`" style="margin-left: 4px;">{{ subOption }}</label>
              </div>

              <!-- 确定按钮 -->
              <div style="text-align: right; margin-top: 8px;">
                <button
                  @click="applyFilter"
                  style="padding: 2px 6px; background-color: #af4c4c; color: white; border: none; border-radius: 3px; cursor: pointer;"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Timeline @nowtime="updateNowtime" :filter-params="appliedPayload" />
    </div>

    <!-- 中间主区 -->
    <div class="main-content">
      <!-- 顶部保留 30px 高度 -->
      <div class="top-bg">Earthquake VA System for St.Himark</div>

      <!-- 下面拆分为左右两列 -->
      <div class="content-body">
        <!-- 左列：再拆为上下两部分 -->
        <div class="left-column">
          <!-- 左列上：放 Map 组件 -->
          <div class="left-top">
            <Map />
          </div>
          <!-- 左列下：注释占位 -->
          <div class="left-bottom">
            <TopicCircle />
          </div>
        </div>

        <!-- 右列：不拆分，上面为注释占位 -->
        <div class="right-column">
          <WordCloud @word-click="handleWordClick" class="word-cloud-full" />
        </div>
      </div>
    </div>

    <!-- 右侧栏 -->
    <div class="sidebar-right">
      <div class="top-bg">
        <span class="count">Count：{{ messagesToShow.length }}</span>
        <input
          type="text"
          v-model="searchInput"
          placeholder="Filter by..."
          class="search-input"
          style="margin-left: 25px;"
        />
        <button class="btn-check" @click="applySearch" style="margin-left: 3px;">
          √
        </button>
        <button class="btn-add" @click="addSomething" style="margin-left: 3px;">
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
import { computed, ref, reactive,onMounted } from 'vue';
import { useStore } from 'vuex';
import Timeline from '~/components/Timeline.vue';
import Map from '~/components/Map.vue';
import Messages from '~/components/Messages.vue';
import TopicCircle from '~/components/TopicCircle.vue';

const store = useStore<{ rawData: Message[]; filterData: Message[]; blockList: string[] }>();
const ignoreBlockList = ref(false);
const blockList = computed<string[]>(() => store.getters.blockList);
const searchInput = ref('');
const appliedSearch = ref('');
const messagesToShow = computed<Message[]>(() => {
  let list: Message[] = store.getters.filterData;
  if (ignoreBlockList.value) {
    list = list.filter((msg: Message) => !blockList.value.includes(msg.account));
  }
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
}
function handleWordClick(clickedWord: string) {
  // 直接把词填进去 searchInput
  searchInput.value = clickedWord;
  // 如果你想点词后自动执行搜索，可以取消下面一行的注释
  // appliedSearch.value = clickedWord;
}
function addSomething() {
  const value = searchInput.value.trim();
    secondOptionsMap.WORDS.push(value);
  }

const firstOptions = ['ALL', 'REGION', 'TOPIC', 'WORDS'] as const;
const secondOptionsMap: Record<string, string[]> = {
  REGION: [
    'Palace Hills',
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
    'West Parton',
  ],
  TOPIC:[
    "Infrastructure Repairs",
    "Utility Safety",
    "Food Supplies",
    "Shelter Housing",
    "Transport Needs",
    "Quake Monitoring",
    "Alerts Precautions",
    "Rescue Assistance",
    "Community Info",
    "Emotional Response",
],
  WORDS: [],
};

const dropdownOpen = ref(false);
const selectedFirst = ref<'ALL' | 'REGION' | 'TOPIC' | 'WORDS'>('ALL');
const selectedSecond = ref<string[]>([]);
const firstLabel = computed(() => selectedFirst.value);
const timelinePayload = computed<Record<string, string[]>>(() => {
  // 如果选了 ALL，就传 { time_region_count: ['All'] }
  if (selectedFirst.value === 'ALL') {
    return { time_region_count: ['All'] };
  }
  // 如果选了 REGION，就传 { time_region_count: [ …selectedSecond… ] }，如果 second 为空，则默认 ['All']
  if (selectedFirst.value === 'REGION') {
    return {
      time_region_count:
        selectedSecond.value.length > 0
          ? [...selectedSecond.value]
          : ['All'],
    };
  }
  // 如果选了 TOPIC，就传 { time_topic_count: [ …selectedSecond… ] }，如果 second 为空，则默认 ['All']
  if (selectedFirst.value === 'TOPIC') {
    return {
      time_topic_count:
        selectedSecond.value.length > 0
          ? [...selectedSecond.value]
          : ['All'],
    };
  }
  // 如果选了 WORDS，就传 { time_word_count: [ …selectedSecond… ] }，如果 second 为空，则默认 ['All']
  if (selectedFirst.value === 'WORDS') {
    return {
      time_word_count:
        selectedSecond.value.length > 0
          ? [...selectedSecond.value]
          : ['All'],
    };
  }
  // 兜底（一般不会走到这里）
  return { time_region_count: ['All'] };
});
const appliedPayload = ref<Record<string, string[]>>({ time_region_count: ['All'] });
function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
}

function onFirstChange() {
  if (selectedFirst.value === 'ALL') {
    selectedSecond.value = [];
  } else {
    selectedSecond.value = [];
  }
}

function applyFilter() {
    appliedPayload.value = timelinePayload.value;
  dropdownOpen.value = false;
}

onMounted(async () => {
  const res = await fetch('http://127.0.0.1:5000/api/initial');
  const data: Message[] = await res.json();
  store.dispatch('initRawData', data);
});

const filterData = computed(() => store.getters.filterData);
const nowtime = ref<[string, string] | null>(null);
const formattedTime = computed(() => {
  if (!nowtime.value || nowtime.value.length === 0) {
    return 'Please select timerange~';
  }
  const [t0, t1] = nowtime.value;
  const formatTime = (time: string | number) => {
    const date = new Date(time);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  };
  return `${formatTime(t0)} ~ ${formatTime(t1)}`;
});

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

/* 左侧栏 & 右侧栏 */
.sidebar-left,
.sidebar-right {
  flex: 0 0 20%;
  height: calc(100% - 30px);
  padding: 0;
  box-sizing: border-box;
  background-color: white;
}

.sidebar-right {
  overflow-y: auto;
}

/* 中间主区 */
.main-content {
  flex: 0 0 60%;
  display: flex;
  flex-direction: column;
  background-color: white;
  /* 不需要 overflow 隐藏了 */
}

/* 顶部 30px */
.main-content .top-bg {
  display: flex;
  width: 100%;
  height: 30px;
  justify-content: center;
  text-align: center;
  align-items: center;
  background-color: #E0A899;
}

/* 主体内容：左右两列 */
.content-body {
  display: flex;
  flex: 1;
  /* 占满剩余高度 */
}

/* 左列：上下两部分 */
.left-column {
  flex: 1;
  display: flex;
  flex-direction: column;

}

.left-top,
.left-bottom {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.left-top {
  /* 地图区域 */
  /* 这里可以按需设置背景或边框 */
}

.left-bottom {
  /* TODO 占位注释区域 */
  background-color: white;
}

/* 右列：整体占据 50% */
.right-column {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* TODO 占位注释区域 */
  background-color: white;
}
.word-cloud-full {
  width: 100%;
  height: 100%;
}
/* 消息容器 */
.messages-container {
  height: calc(100% - 30px);
  overflow-y: auto;
  padding: 0;
  margin: 0;
}

/* 侧栏顶部 30px */
.sidebar-left .top-bg,
.sidebar-right .top-bg {
  display: flex;
  align-items: center;
  padding: 0 10px;
  height: 30px;
  background-color: #E0A899;
}

.sidebar-left .top-bg {
  justify-content: center;
}

.sidebar-right .top-bg {
  justify-content: flex-start;
}

/* 右侧开关计数 */
.count {
  text-align: left;
}

/* Toggle Switch 样式 */
.switch {
  position: absolute;
  display: inline-block;
  left: 96.8%;
  width: 40px;
  height: 20px;
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
  background-color: #ffffff6c;
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
  background-color: #af4c4c;
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
}

.search-input {
  width: 120px;
  height: 100%;
  margin: 0 8px;
  padding: 2px 4px;
  border: 2px solid #ccc;
  border-radius: 4px;
}

.btn-check,
.btn-add {
  width: 24px;
  height: 24px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 24px;
}

.btn-check:hover,
.btn-add:hover {
  color: #fff;
}
</style>
