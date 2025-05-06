import { createStore } from "vuex";
import blacklist from "../data/blacklist.json";
import wordgraph from "../../../server/data/word_graph_final.json";

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
}

export interface State {
  rawData: Message[];
  filterData: Message[];
  filterDataForHeatmap: Message[];
  blockList: string[];
}

export interface WordNode {
  index: number;
  word: string;
  messages: number[];
}

export interface WordLink {
  source: number;
  target: number;
  weight: number;
}

export interface WordGraph {
  nodes: WordNode[];
  links: WordLink[];
}

export default createStore<State>({
  state: {
    rawData: [] as Message[],
    filters: {
      start: null as Date | null,
      end: null as Date | null,
      keyword: "" as string,
      location: "" as string,
    },
    blockList: blacklist as string[],
    filterDataForHeatmap: [] as Message[],
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
      );
    },
    filterWordGraph(state, getters): WordGraph {
      const ids = new Set(getters.filterData.map((m: Message) => m.index));
      const allNodes = (wordgraph.nodes as WordNode[]).filter((node) =>
        node.messages.some((msgId) => ids.has(msgId))
      );
      const topNodes = allNodes
        .sort((a, b) => b.messages.length - a.messages.length)
        .slice(0, 50);
      const nodeIndexes = new Set(topNodes.map((n) => n.index));
      const links = (wordgraph.links as WordLink[]).filter(
        (l) => nodeIndexes.has(l.source) && nodeIndexes.has(l.target)
      );
      return { nodes: topNodes, links };
    },
    filterDataForHeatmap(state): Message[] {
      let data = state.rawData;
      if (state.filters.start && state.filters.end) {
        data = data.filter((m) => {
          const t = new Date(m.time);
          return t >= state.filters.start! && t <= state.filters.end!;
        });
      }
      if (state.filters.keyword) {
        data = data.filter((m) =>
          m.message_words.includes(state.filters.keyword)
        );
      }
      return data;
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
    SET_FILTER_DATA(state, payload: Message[]) {
      state.filterData = payload;
    },
    SET_BLOCK_LIST(state, payload: string[]) {
      state.blockList = payload;
    },
  },
  actions: {
    initRawData({ commit }, payload: Message[]) {
      commit("SET_RAW_DATA", payload);
    },
    setTimeRange({ commit }, range: { start: Date; end: Date }) {
      commit("SET_TIME_RANGE", range);
      this.dispatch("updateHeatmapData");
    },
    setKeyword({ commit }, kw: string) {
      commit("SET_KEYWORD_FILTER", kw);
      this.dispatch("updateHeatmapData");
    },
    setLocation({ commit }, loc: string) {
      commit("SET_LOCATION_FILTER", loc);
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
