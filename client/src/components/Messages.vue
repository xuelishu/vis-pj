<template>
  <el-card
    class="box-card"
    shadow="hover"
    @click.stop="toggleMenu"
  >
    <div id="container-message">
      <div id="left-col">
        <div
          class="sentiment"
          :style="{ backgroundColor: colorSentiment }"
        ></div>
      </div>
      <div id="middle-col">
        <div id="timestamp">
          {{ message.time }}
          <span class="location-text">📍{{ message.location }}</span>
        </div>
        <div id="message-content" :style="{ textDecoration: isBlocked ? 'line-through' : 'none' }">
          <span class="account" :style="{ color: 'orange'}">
            {{ message.account }}：
          </span>
          <span
            class="account"
            v-for="a in message.at"
            :key="a"
            style="color: steelblue;"
          >
            @{{ a }}
          </span>
          <span>{{ message.message_words }}</span>
          <span class="tag" v-for="t in message.tag" :key="t">
            #{{ t }}
          </span>
        </div>
      </div>
      <div id="right-col">
<img
  :src="`/${message.topic}.svg`"
  alt="topic icon"
  class="topic-icon"
/>
      </div>
    </div>
    <div v-if="showMenu" class="action-menu">
      <el-button
  size="small"
  class="menu-btn"
  @click="onChangeTopic"
>Change Topic</el-button>
<el-button
  size="small"
  class="menu-btn"
  @click="isBlocked ? removeFromBlacklist() : addToBlacklist()"
>{{ isBlocked ? 'Remove Blacklist' : 'Add to Blacklist' }}</el-button>
    </div>
  </el-card>
</template>

<script lang="ts" setup>
import {computed} from 'vue'
import * as d3 from 'd3'
import { useStore } from 'vuex'
import type { Message } from '~/store/data'

const props = defineProps<{message: Message}>()
const store = useStore()
const blockList = computed(() => store.getters.blockList as string[])
const isBlocked = computed(() =>blockList.value.includes(props.message.account))
const showMenu = ref(false)
function toggleMenu() {
  showMenu.value = !showMenu.value
}
function onChangeTopic() {
  showMenu.value = false
}
function addToBlacklist() {
  const next = [...blockList.value, props.message.account]
  store.dispatch('updateBlockList', next)
  showMenu.value = false
}
function removeFromBlacklist() {
  const next = blockList.value.filter(a => a !== props.message.account)
  store.dispatch('updateBlockList', next)
  showMenu.value = false
}

const colorSentiment = computed(() => {
  const e = props.message.emotion
  return e <= 0.5? d3.interpolateRgb("red", "yellow")(e * 2): d3.interpolateRgb("yellow", "green")((e - 0.5) * 2)})
</script>

<style scoped>
.box-card {
  width: 95%;
  margin-top: 5px;
  position: relative;
}

#container-message {
  display: flex;
  width: 100%;
  height: 100%;
}

#left-col {
  flex: 0 0 10%;
  display: flex;
  justify-content: start;
  align-items: center;
}

#middle-col {
  flex: 0 0 70%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

#timestamp {
  color: silver;
  font-size: x-small;
  margin-bottom: 0.5em;
}

#message-content {
  word-break: keep-all;
  font-size: 13px;
}

#right-col {
  flex: 0 0 20%;
}

.sentiment {
  border-radius: 50%;
  width: 1em;
  height: 1em;
  border: 2px solid silver;
}

.tag {
  color: steelblue;
}

.action-menu {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  /* 下面这句让子按钮统一贴左对齐 */
  align-items: flex-start;

  /* 给整个菜单一条 border */
  background: #fff;
  border: 0px solid #ccc;
  border-radius: 4px;
  padding: 0px;
  z-index: 10;
  animation: fadeOut 0.5s ease-in-out 3s forwards;
}
@keyframes fadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}

.action-menu .menu-btn {
  /* 先清掉默认 margin/padding */
  margin: 0;
  padding: 0;

  /* 变成 flex 才好居中文字 */
  display: flex;
  align-items: center;
  justify-content: center;

  /* 统一尺寸 */
  width: 100px;
  height: 28px;
  line-height: 28px;
}
.pin-icon,
.location-text {
  color: pink;
}
.topic-icon {
width: 100%;
height: 100%;
object-fit: contain;

/* 整张图先变成浅灰色：先灰度化 + 提亮一下 */
filter: grayscale(100%) brightness(150%);

/* 从右到左的透明度渐变：从 0.8 过渡到 0 */
-webkit-mask-image: linear-gradient(
  to left,
  rgba(0, 0, 0, 0.2),
  rgba(0, 0, 0, 0)
);
mask-image: linear-gradient(
  to left,
  rgba(0, 0, 0, 0.2),
  rgba(0, 0, 0, 0)
);
-webkit-mask-repeat: no-repeat;
mask-repeat: no-repeat;}
</style>