import { createStore } from "vuex";
import blacklist from "../data/blacklist.json";
import wordcloudData from "../../../server/data/wordcloud.json";

export interface Message {
  index: number;
  time: string;
  location: string;
  account: string;
  message: string;
  at: string[];
  tag: string[];
  message_words: string;
  message_revised: string;
  emotion: number;
  topic: string;
}

export interface State {
  rawData: Message[];
  filterData: Message[];
  filterDataForHeatmap: Message[];
  blockList: string[];
  wordCloudResult: Array<{ name: string; value: number }>;
  wordsPieChart: Array<{ name: string; value: number }>;
  topicsPieChart: Array<{ name: string; value: number }>;
  filters: {
    start: Date | null;
    end: Date | null;
    keyword: string;
    location: string;
    pieWordFilter: string;
    pieTopicFilter: string;
  };
}

export interface WordEntry {
  index: number;
  word: string;
  messages: number[];
}

export default createStore<State>({
  state: {
    rawData: [] as Message[],
    filters: {
      start: null as Date | null,
      end: null as Date | null,
      keyword: "" as string,
      location: "" as string,
      pieWordFilter: "" as string,
      pieTopicFilter: "" as string,
    },
    blockList: blacklist as string[],
    filterDataForHeatmap: [] as Message[],
    wordCloudResult: [] as Array<{ name: string; value: number }>,
    wordsPieChart: [] as Array<{ name: string; value: number }>,
    topicsPieChart: [] as Array<{ name: string; value: number }>,
  },
  getters: {
    rawData: (state) => state.rawData,
    blockList: (state) => state.blockList,
    filterData(state): Message[] {
      if (!state.filters.start || !state.filters.end) {
        return [];
      }
      return (
        state.rawData
          .filter((m) => {
            if (!state.filters.start || !state.filters.end) return true;
            const t = new Date(m.time);
            return t >= state.filters.start! && t <= state.filters.end!;
          })
          .filter((m) => {
            return state.filters.keyword
              ? m.message_words.includes(state.filters.keyword)
              : true;
          })
          .filter((m) => {
            return state.filters.location
              ? m.location === state.filters.location
              : true;
          })
          .filter((m) => {
            if (!state.filters.pieWordFilter) {
              // 为空串，表示不再做特殊词筛选
              return true;
            }
            // 只保留 message_words 中包含 pieWordFilter 的
            return m.message_words.includes(state.filters.pieWordFilter);
          })
          // ——— 新增：如果 pieTopicFilter 非空，就只保留 topic === pieTopicFilter 的 message ——
          .filter((m) => {
            if (!state.filters.pieTopicFilter) {
              return true;
            }
            // 只保留 topic EXACT MATCH 的
            return m.topic === state.filters.pieTopicFilter;
          })
      );
    },
    filterDataForHeatmap(state, getters): Message[] {
      return getters.filterData as Message[];
    },
    wordCloudData(
      state,
      getters
    ): Array<{ name: string; value: number; sentiment: number }> {
      // 1. 先拿到当前筛选后的 Message 列表
      const filteredMsgs = getters.filterData as Message[];
      // 2. 将它们的 index 放到 Set 里，方便后续快速查找
      const filteredIndexSet = new Set<number>(
        filteredMsgs.map((m: Message) => m.index)
      );
      const emotionMap = new Map<number, number>(
        filteredMsgs.map((m: Message) => [m.index, m.emotion])
      );
      // 3. wordcloudData 本身是从 JSON 导入的，结构应符合 WordEntry[]
      const arr = (wordcloudData as WordEntry[]).map((entry) => {
        let countInFilter = 0;
        let emotionSum = 0;
        // 遍历这个词对应的所有消息 index，如果该 index 在过滤后的集合里，就累加计数并取出情感值
        entry.messages.forEach((msgIdx) => {
          if (filteredIndexSet.has(msgIdx)) {
            countInFilter += 1;
            const emo = emotionMap.get(msgIdx);
            if (typeof emo === "number") {
              emotionSum += emo;
            }
          }
        });
        // 计算平均情感（如果 countInFilter 为 0，就让 sentiment = 0 或者 null，看业务需求）
        const sentiment = countInFilter > 0 ? emotionSum / countInFilter : 0;
        return {
          name: entry.word,
          value: countInFilter,
          sentiment,
        };
      });

      return arr
        .filter((item) => item.value >= 3)
        .sort((a, b) => b.value - a.value)
        .slice(0, 100);
    },
    specialWordsData(state, getters): Array<{ name: string; value: number }> {
      const specialList = ["power", "water" ,"nuclear","shelter","road","fire","gas","rescue","bridge","medicine","food","sewer","volunteer","transport","collapse"];
      // 先拿到完整的 wordCloudData（已经做过 count & 剔除 value < 3）
      const allWords = getters.wordCloudData as Array<{
        name: string;
        value: number;
      }>;
      // 把 specialList 里面出现的项挑出来即可（如果不存在就跳过）
      return allWords.filter((item) => specialList.includes(item.name));
    },
    topicsPieData(state, getters): Array<{ name: string; value: number }> {
      // 1. 先拿到当前筛选后的 Message 列表
      const filteredMsgs: Message[] = getters.filterData as Message[];
      // 2. 用一个临时 Map 统计各 topic 的计数
      const countMap: Record<string, number> = {};
      filteredMsgs.forEach((msg) => {
        const t = msg.topic;
        if (t && t !== "Junk") {
          if (!countMap[t]) {
            countMap[t] = 1;
          } else {
            countMap[t]++;
          }
        }
      });
      // 3. 把 Map 转成 {name, value} 数组，并去重、排序（可选）
      const arr: Array<{ name: string; value: number }> = Object.entries(
        countMap
      ).map(([topicName, cnt]) => ({ name: topicName, value: cnt }));
      // （如果想要按照出现次数倒序，可以加下面一行；也可以按业务需求去排序）
      arr.sort((a, b) => b.value - a.value);
      return arr;
    },
  },
  mutations: {
    SET_RAW_DATA(state, payload: Message[]) {
      state.rawData = payload;
    },
    SET_FILTER_DATA_FOR_HEATMAP(state, payload: Message[]) {
      state.filterDataForHeatmap = payload;
    },
    SET_TIME_RANGE(state, payload: { start: Date; end: Date }) {
      state.filters.start = payload.start;
      state.filters.end = payload.end;
    },
    SET_KEYWORD_FILTER(state, kw: string) {
      state.filters.keyword = kw;
    },
    SET_LOCATION_FILTER(state, loc: string) {
      state.filters.location = loc;
    },
    SET_PIE_WORD_FILTER(state, payload: string) {
      state.filters.pieWordFilter = payload;
    },
    SET_PIE_TOPIC_FILTER(state, payload: string) {
      state.filters.pieTopicFilter = payload;
    },
    SET_FILTER_DATA(state, payload: Message[]) {
      state.filterData = payload;
    },
    SET_BLOCK_LIST(state, payload: string[]) {
      state.blockList = payload;
    },
    SET_WORDCLOUD_RESULT(
      state,
      payload: Array<{ name: string; value: number }>
    ) {
      state.wordCloudResult = payload;
    },
    SET_WORDS_PIE_CHART(
      state,
      payload: Array<{ name: string; value: number }>
    ) {
      state.wordsPieChart = payload;
    },
    SET_TOPICS_PIE_CHART(
      state,
      payload: Array<{ name: string; value: number }>
    ) {
      state.topicsPieChart = payload;
    },
  },
  actions: {
    initRawData({ commit }, payload: Message[]) {
      commit("SET_RAW_DATA", payload);
    },
    setTimeRange({ commit }, range: { start: Date; end: Date }) {
      commit("SET_TIME_RANGE", range);
      this.dispatch("updateHeatmapData");
      const wordCloud = this.getters.wordCloudData;
      commit("SET_WORDCLOUD_RESULT", wordCloud);
      const specialWords_afterTime = this.getters.specialWordsData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_WORDS_PIE_CHART", specialWords_afterTime);
      const topics_afterTime = this.getters.topicsPieData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_TOPICS_PIE_CHART", topics_afterTime);
    },
    setKeyword({ commit }, kw: string) {
      commit("SET_KEYWORD_FILTER", kw);
      this.dispatch("updateHeatmapData");
      const wordCloud = this.getters.wordCloudData;
      commit("SET_WORDCLOUD_RESULT", wordCloud);
      const specialWords_afterKW = this.getters.specialWordsData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_WORDS_PIE_CHART", specialWords_afterKW);
      const topics_afterKW = this.getters.topicsPieData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_TOPICS_PIE_CHART", topics_afterKW);
    },
    setLocation({ commit }, loc: string) {
      commit("SET_LOCATION_FILTER", loc);
      const wordCloud = this.getters.wordCloudData;
      commit("SET_WORDCLOUD_RESULT", wordCloud);
      const specialWords_afterLoc = this.getters.specialWordsData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_WORDS_PIE_CHART", specialWords_afterLoc);
      const topics_afterLoc = this.getters.topicsPieData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_TOPICS_PIE_CHART", topics_afterLoc);
    },
    setPieWordFilter({ commit, dispatch }, pieWord: string) {
      // pieWord 可能是 “power”、“water” 或 空串 ""
      commit("SET_PIE_WORD_FILTER", pieWord);
      // 1）filterData 会因为我们刚才改过 getter.filterData 而重新生效
      dispatch("updateHeatmapData");
      // 2）立即重新生成词云
      const wordCloud = this.getters.wordCloudData;
      commit("SET_WORDCLOUD_RESULT", wordCloud);
      // 3）重新计算「specialWordsPieChart」数据
      const specialWords_afterPie = this.getters.specialWordsData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_WORDS_PIE_CHART", specialWords_afterPie);
      // 4）重新计算「topicsPieChart」数据（因为 filterData 变了，topics 也会变）
      const topics_afterPie = this.getters.topicsPieData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_TOPICS_PIE_CHART", topics_afterPie);
    },
    // 【新增】当用户在 topic 饼图上点了某个 topic（或点第二次要清空），就调用这个 action
    setPieTopicFilter({ commit, dispatch }, pieTopic: string) {
      // pieTopic 可能是 “Shelter Housing”、“Utility Safety” 等，或 空串 ""
      commit("SET_PIE_TOPIC_FILTER", pieTopic);
      // 1）filterData 会因为我们刚才改过 getter.filterData 而重新生效
      dispatch("updateHeatmapData");
      // 2）重新生成词云
      const wordCloud = this.getters.wordCloudData;
      commit("SET_WORDCLOUD_RESULT", wordCloud);
      // 3）重新计算「specialWordsPieChart」数据，因为 filterData 变了，specialWordsData 也会变
      const specialWords_afterTopic = this.getters.specialWordsData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_WORDS_PIE_CHART", specialWords_afterTopic);
      // 4）重新计算「topicsPieChart」数据
      const topics_afterTopic = this.getters.topicsPieData as Array<{
        name: string;
        value: number;
      }>;
      commit("SET_TOPICS_PIE_CHART", topics_afterTopic);
    },
    updateHeatmapData({ getters, commit }) {
      const arr = getters.filterDataForHeatmap as Message[];
      commit("SET_FILTER_DATA_FOR_HEATMAP", arr);
    },
    updateBlockList({ commit }, newList: string[]) {
      commit("SET_BLOCK_LIST", newList);
    },
    resetFilter({ state, commit }) {
      commit("SET_FILTER_DATA", state.rawData);
    },
    filterByTime({ state, commit }, payload: { start: Date; end: Date }) {
      const { start, end } = payload;
      const filtered = state.rawData.filter((m) => {
        const t = new Date(m.time);
        return t >= start && t <= end;
      });
      commit("SET_FILTER_DATA", filtered);
    },
  },
});
