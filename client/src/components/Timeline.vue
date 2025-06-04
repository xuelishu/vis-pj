<template>
  <div ref="container" class="area-chart-container">
    <div class="divider" ref="axisContainer"></div>
    <div class="col-right" ref="chartContainer">
      <svg ref="areaSvg"></svg>
    </div>
  </div>
</template>

<script>
import { defineComponent, watch, onMounted } from 'vue'
import * as d3 from 'd3'
import rawJson from '../../../server/data/time_count.json'
import { useStore } from 'vuex'

export default {
  name: 'D3AreaSmoothChart',
  props: {
    filterParams: {
      type: Object,
      default: () => ({
        // 你想要的初始值
        time_region_count: ['All']
      })
    }
  },
    setup(props) {
    const store = useStore()
    return { store }
  },
  mounted(){
this.fetchAndDraw(this.filterParams);
  },
    watch: {
filterParams: {
      handler(newPayload) {
        // 清空旧图
        d3.select(this.$refs.axisContainer).selectAll('*').remove();
        d3.select(this.$refs.areaSvg).selectAll('*').remove();
        // 用新的 payload 去拿数据并画图
        this.fetchAndDraw(newPayload);
      },
      deep: true
    }
  },
  methods: {
        async fetchAndDraw(payload) {
      try {
        console.log(payload)
        // 注意把下面这行换成你项目实际的请求地址与方式
        const response = await fetch('http://127.0.0.1:5000/api/time_count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        // 假设后端返回的是 { data: [{ time: "...", count: 123 }, ...] }
        const json = await response.json();
      // 2. 再从 json 中拿 data 数组
      const rawArray = json.data;
      console.log(rawArray)
        this.drawChart(rawArray);
      } catch (err) {
        console.error('拿时间序列数据失败：', err);
        // 如果要兜底，也可以用本地的 rawJson 数据作为示例：
        // const arr = rawJson[0]['All'] || [];
        // this.drawChart(arr);
      }
    },
drawChart(rawArray) {
  const parseTime = d3.utcParse('%Y-%m-%d %H:%M:%S')
  const startTime = parseTime('2020-04-06 00:00:00')
  const endTime   = parseTime('2020-04-10 11:59:00')

  // 1. 标准化 & 过滤 & 排序（保持不变）
  const series = rawArray
    .map(d => {
      if (d.time != null && d.count != null) {
        return { date: parseTime(d.time), count: +d.count }
      }
      const [k, v] = Object.entries(d)[0]
      return { date: parseTime(k), count: +v }
    })
    .filter(d => d.date instanceof Date && !isNaN(d.count))
    .sort((a, b) => d3.ascending(a.date, b.date))

  // ====== 【改动开始】给 y 轴留上下边距 ======
  // 2. 时间范围 & 尺寸
  const axisContainer   = this.$refs.axisContainer
  const heightAll       = axisContainer.clientHeight   // 原来取到的是整个容器高度
  const chartContainer  = this.$refs.chartContainer
  const widthAll        = chartContainer.clientWidth

  // 定义上下边距，单位 px。可根据实际文字高度微调，比如 20、15 之类
  const marginTop       = 20
  const marginBottom    = 20

  // 3. yScale：把 domain 放到 [marginTop, heightAll - marginBottom]
  const yScale = d3.scaleTime()
    .domain([startTime, endTime])
    .range([marginTop, heightAll - marginBottom])

  // 4. 生成每小时刻度位置（保持不变）
  const allHours = d3.timeHour.range(
    startTime,
    d3.timeHour.offset(endTime, 1),
    1
  )

  // 5. 在 .divider 中插入 SVG 并画左侧坐标轴
  //    注意 SVG 高度不变，仍然用 heightAll，让上下留白空间生效
  const axisSvg = d3.select(axisContainer)
    .append('svg')
    .classed('axis-svg', true)
    .attr('width', 80)       // 与 .divider 固定宽度保持一致
    .attr('height', heightAll)
    .style('position', 'absolute')
    .style('top', 0)
    .style('left', 0)

  // 使用 axisLeft，让刻度线向左延伸，标签文字放在左侧
  const axisG = axisSvg.append('g')
    // 把坐标轴横向平移到 x=80，纵向不需要再动（因为 range 里已经加了 marginTop）
    .attr('transform', 'translate(80,0)')
    .call(
      d3.axisLeft(yScale)
        .tickValues(allHours)
        .tickSize(6)
        .tickPadding(4)
        .tickFormat(d => {
          if (d.getUTCHours() % 6 !== 0) return ''
          const timeStr = d3.utcFormat('%H:%M')(d)
          if (d.getUTCHours() === 0) {
            const dateStr = d3.utcFormat('%m-%d')(d)
            return `${dateStr} ${timeStr}`
          }
          return timeStr
        })
    )
    .call(g => g.select('.domain').remove())

  // 6. 为每个刻度分组（g.tick）设样式（保持不变）
  axisG.selectAll('g.tick')
    .each(function (d) {
      const g = d3.select(this)
      g.select('line')
        .attr('stroke', '#000')
        .attr('stroke-width', d.getUTCHours() === 0 ? 2 : 1)
      g.select('text')
        .attr('fill', '#000')
        .attr('font-size', '12px')
    })

  // 7. 绘制柱状条：xScale + <rect>
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.count)])
    .range([0, widthAll])

  const svg = d3.select(this.$refs.areaSvg)
    .attr('width', widthAll)
    .attr('height', heightAll)

  // 计算每个柱子的高度，这里简单地把可用高度平均分给所有数据点
  // 注意：series.length 不变，因为我们只在 yScale 上做了“上下压缩”
  const barHeight = (heightAll - marginTop - marginBottom) / series.length

  svg.selectAll('rect')
    .data(series)
    .enter()
    .append('rect')
    .attr('x', 0)
    // Y 位置要用 yScale(d.date)，但是此时 yScale(d.date) 已经包含了 marginTop
    .attr('y', d => yScale(d.date) - barHeight / 2)
    .attr('width', d => xScale(d.count))
    .attr('height', barHeight)
    .attr('fill', 'black')

  // 9. 添加刷选交互（保持不变）；不过要注意 brush 区域还是 cover 整个 container
  const containerEl     = this.$refs.container
  const containerWidth  = containerEl.clientWidth
  const containerHeight = containerEl.clientHeight

  const brush = d3.brushY()
    .extent([[0, 0], [containerWidth, containerHeight]])
    .on('end', (event) => {
      if (!event.selection) return
      const [y0, y1] = event.selection
      // 下面计算映射到时间，需要减掉 marginTop，因为坐标轴是从 marginTop 开始
      const t0 = yScale.invert(y0-90)
      const t1 = yScale.invert(y1-90)
      this.$store.dispatch('setTimeRange', { start: t0, end: t1 })
      this.$emit('nowtime', [t0, t1])
      console.log(y0)
    })

  const overlay = d3.select(containerEl).append('svg')
    .attr('class', 'brush-overlay')
    .attr('width', containerWidth)
    .attr('height', containerHeight)
    .style('position', 'absolute')
    .style('top', 0)
    .style('left', 0)
    .style('pointer-events', 'all')
    .style('z-index', 3)

  overlay.append('g')
    .attr('class', 'brush')
    .call(brush)
}

  }
}
</script>

<style scoped>
.area-chart-container {
  display: flex;
  width: 100%;
  height: calc(100% - 30px);
  position: relative;
}

/* 左侧留空 20px，用于放置坐标轴及刻度/标签 */
.divider {
  flex: 0 0 80px;   /* 宽度固定 20px */
  background-color: #fff;
  position: relative;
  overflow: visible; /* 允许刻度线和文字溢出 */
  z-index: 2;        /* 刻度/标签放在图层之上 */
}

/* 面积图容器，紧贴在 .divider 右侧 */
.col-right {
  flex: 1;
  position: relative;
  z-index: 1;
}

/* 允许 SVG 超出容器绘制 */
.axis-svg,
.col-right svg {
  overflow: visible;
}

.col-right svg {
  display: block;
  width: 100%;
  height: 100%;
}

.brush-overlay {
  overflow: visible;
  background: transparent; /* 不遮挡下层内容 */
}

.brush .selection {
  fill: rgba(0, 120, 215, 0.3);
  stroke: #0078d7;
}
</style>
