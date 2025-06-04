<template>
  <div ref="container" class="area-chart-container">
    <div class="divider" ref="axisContainer"></div>
    <div class="col-right" ref="chartContainer">
      <svg ref="areaSvg"></svg>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, watch, onMounted, toRefs } from 'vue'
import * as d3 from 'd3'

export default defineComponent({
  name: 'D3AreaSmoothChart',
  props: {
    // 父组件传进来完整的筛选参数，例如 { "REGION": ["region1","region2"] }
    filterParams: {
      type: Object as () => Record<string, string[]>,
      required: true
    }
  },
  setup(props) {
    // 解构一下，以便 watch
    const { filterParams } = toRefs(props)
    return { filterParams }
  },
  async mounted() {
    // 组件首次挂载，直接用 props.filterParams 向后端请求
    await this.fetchAndDraw(this.filterParams)
  },
  watch: {
    // 只要父组件传入的 filterParams 发生变化，就重新拉数据并绘图
    filterParams: {
      immediate: false,
      deep: true,
      async handler(newParams) {
        // 清空旧图
        d3.select(this.$refs.axisContainer).selectAll('*').remove()
        d3.select(this.$refs.areaSvg).selectAll('*').remove()
        // 重新拉取、重绘
        await this.fetchAndDraw(newParams)
      }
    }
  },
  methods: {
    /**
     * 1. 给后端传 filterParams，拿到 rawArray → 直接调用 drawChart(rawArray)
     */
    async fetchAndDraw(params) {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/time_count', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        })
        const json = await res.json()
        // 假设后端返回的是一个数组，数组第0项是一个对象，包含多个类
        // 例如：[ { "region1": [ ... ], "region2": [ ... ] } ]
        const rawArray = Array.isArray(json) ? json[0] : {}
        this.drawChart(rawArray)
      } catch (err) {
        console.error('fetchAndDraw 请求失败：', err)
        this.drawChart({}) // 传空对象，绘一个空图
      }
    },

    /**
     * 2. drawChart：把后端 rawArray 解析成堆叠柱状图
     *
     *    rawArray 形如：
     *    {
     *      "region1": [ { "2020-04-06 00:02:00": 1 }, { "2020-04-06 00:04:00": 2 }, … ],
     *      "region2": [ { "2020-04-06 00:02:00": 3 }, { "2020-04-06 00:04:00": 1 }, … ],
     *      …
     *    }
     */
    drawChart(rawArray) {
      // ─── 1. 清空旧图 ───
      d3.select(this.$refs.axisContainer).selectAll('*').remove()
      d3.select(this.$refs.areaSvg).selectAll('*').remove()

      // 如果 rawArray 为空对象或没有任何 key，直接 return
      const classNames = Object.keys(rawArray || {})
      if (classNames.length === 0) {
        return
      }

      // ─── 2. 将 rawArray 转成 d3 stack 需要的“日期 + 各类 count”格式 ───
      // 2.1. 提取所有时间戳字符串，并转为 Date 排序
      const parseTime = d3.utcParse('%Y-%m-%d %H:%M:%S')
      const timeSet = new Set < string > ()
      classNames.forEach(cls => {
        rawArray[cls].forEach(item => {
          const ts = Object.keys(item)[0]
          timeSet.add(ts)
        })
      })
      const allTimeStrings = Array.from(timeSet)
      // 转成 Date，过滤掉无效的，并排序
      const allDates = allTimeStrings
        .map(str => {
          const d = parseTime(str)
          return d instanceof Date && !isNaN(d) ? d : null
        })
        .filter(d => d !== null) as Date[]
      allDates.sort(d3.ascending)

      // 2.2. 构造一个“按时间汇总各类 count”的二维表
      // data 形如：
      // [ { date: Date, region1: 1, region2: 3, … }, { date: Date, region1: 2, region2: 1, … }, … ]
      const data = allDates.map(dateObj => {
        const timeKey = d3.utcFormat('%Y-%m-%d %H:%M:%S')(dateObj)
        const row: Record<string, unknown> = { date: dateObj }
        classNames.forEach(cls => {
          // 在 rawArray[cls] 数组里找有没有 timeKey
          const found = rawArray[cls].find(item => Object.keys(item)[0] === timeKey)
          row[cls] = found ? +Object.values(found)[0] : 0
        })
        return row
      })

      // 2.3. 计算最大累计值，用于 Y 轴 domain
      const maxTotal = d3.max(data, d =>
        classNames.reduce((sum, cls) => sum + (d[cls] as number), 0)
      ) as number

      // ─── 3. 准备画布尺寸 & 比例尺 ───
      const axisContainer = this.$refs.axisContainer
      const chartContainer = this.$refs.chartContainer
      const axisWidth = axisContainer.clientWidth   // 80px 左侧留给 Y 轴
      const fullHeight = axisContainer.clientHeight // 整个可视高度
      const fullWidth = chartContainer.clientWidth  // 整个可视宽度

      // 为了给顶部图例留 30px，底部 X 轴留 30px
      const margin = { top: 30, right: 20, bottom: 30, left: 0 }
      const innerWidth = fullWidth - margin.left - margin.right
      const innerHeight = fullHeight - margin.top - margin.bottom

      // 3.1. xScale：时间 → [0, innerWidth]
      const xScale = d3
        .scaleTime()
        .domain(d3.extent(allDates) as [Date, Date])
        .range([0, innerWidth])

      // 3.2. yScale：累积 count → [innerHeight, 0]
      const yScale = d3
        .scaleLinear()
        .domain([0, maxTotal])
        .nice()
        .range([innerHeight, 0])

      // 3.3. colorScale：为每个 classNames 分配颜色
      const color = d3
        .scaleOrdinal < string, string> (d3.schemeCategory10)
          .domain(classNames)

      // ─── 4. 绘制左侧 Y 轴 ───
      const axisSvg = d3
        .select(axisContainer)
        .append('svg')
        .attr('width', axisWidth)
        .attr('height', fullHeight)
        .style('position', 'absolute')
        .style('top', 0)
        .style('left', 0)

      // 把坐标轴放到 x = axisWidth（80px），向下偏移 margin.top
      const yAxisG = axisSvg
        .append('g')
        .attr('transform', `translate(${axisWidth}, ${margin.top})`)
        .call(d3.axisLeft(yScale).ticks(5))
        .call(g => g.select('.domain').remove())

      // ─── 5. 绘制底部 X 轴 + 主绘图区 ───
      const svg = d3
        .select(this.$refs.areaSvg)
        .attr('width', fullWidth)
        .attr('height', fullHeight)

      // 在顶端留出 margin.top（画图例），底部留出 margin.bottom（画 X 轴标签）
      const chartG = svg
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)

      // 5.1. 画 X 轴，放在 chartG 底部
      const xAxisG = chartG
        .append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(
          d3
            .axisBottom(xScale)
            .ticks(d3.timeHour.every(6))
            .tickFormat(d => {
              // 仅每 6 小时显示文字。若整点 00:00，则拼上日期
              const hours = (d as Date).getUTCHours()
              if (hours === 0) {
                const dateStr = d3.utcFormat('%m-%d')(d as Date)
                const timeStr = d3.utcFormat('%H:%M')(d as Date)
                return `${dateStr} ${timeStr}`
              }
              return d3.utcFormat('%H:%M')(d as Date)
            })
        )

      xAxisG
        .selectAll('text')
        .attr('transform', 'rotate(-35)')
        .style('text-anchor', 'end')

      // ─── 6. 计算堆叠布局 → 绘制垂直堆叠柱 ───
      // 6.1. 使用 d3.stack()，keys = classNames
      const stackGen = d3.stack < Record < string, any>> ().keys(classNames)
      const stackedSeries = stackGen(data)
      // stackedSeries[i] 代表 classNames[i]，其内部是 [ [y0, y1, dataIndex], … ]

      // 6.2. 为每个类（层）创建一个 <g class="layer">，并设置 fill
      const layerG = chartG
        .selectAll('.layer')
        .data(stackedSeries)
        .enter()
        .append('g')
        .attr('class', 'layer')
        .attr('fill', d => color(d.key))

      // 6.3. 在每个 layer 中，为每个时间点画一个 <rect>
      layerG
        .selectAll('rect')
        .data(d => d) // d 是该类在每个时间点上的堆叠数据数组
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.data.date) as number)
        .attr('y', d => yScale(d[1]))
        .attr('height', d => yScale(d[0]) - yScale(d[1]))
        .attr('width', () => {
          // 为了让柱子在时间轴上看起来有间隙，用时间间隔来算宽度
          if (allDates.length > 1) {
            const delta = allDates[1].getTime() - allDates[0].getTime()
            const pxPerMs =
              innerWidth /
              (allDates[allDates.length - 1].getTime() -
                allDates[0].getTime())
            return pxPerMs * delta - 1 // 留 1px 的间隙
          }
          return 0
        })

      // ─── 7. 添加图例 ───
      // 把图例放在 areaSvg 左上角（离左侧 Y 轴右边 10px，离顶 5px）
      const legendG = svg
        .append('g')
        .attr('transform', `translate(${axisWidth + 10}, ${5})`)

      classNames.forEach((cls, i) => {
        const row = legendG
          .append('g')
          .attr('transform', `translate(0, ${i * 20})`)

        // 小色块
        row
          .append('rect')
          .attr('width', 12)
          .attr('height', 12)
          .attr('fill', color(cls) as string)

        // 类名文字
        row
          .append('text')
          .attr('x', 16)
          .attr('y', 10)
          .attr('font-size', '12px')
          .text(cls)
      })

      // ─── 8. 添加横向 BrushX，完成与 Vuex 的联动 ───
      const brush = d3
        .brushX()
        .extent([
          [0, 0],
          [innerWidth, innerHeight]
        ])
        .on('end', event => {
          if (!event.selection) return
          const [x0, x1] = event.selection
          const t0 = xScale.invert(x0)
          const t1 = xScale.invert(x1)
          this.$emit('nowtime', [t0, t1])
          // 你也可以 dispatch 到 Vuex：this.$store.dispatch('setTimeRange', { start: t0, end: t1 })
        })

      chartG
        .append('g')
        .attr('class', 'brush')
        .call(brush)
        .attr('transform', `translate(0, 0)`)
    }
  }
})
</script>

<style scoped>
.area-chart-container {
  display: flex;
  width: 100%;
  height: calc(100% - 30px);
  position: relative;
}

/* 左侧留 80px 给纵轴 */
.divider {
  flex: 0 0 80px;
  background-color: #fff;
  position: relative;
  overflow: visible;
  z-index: 2;
}

/* 右侧主图紧贴在 .divider 右侧 */
.col-right {
  flex: 1;
  position: relative;
  z-index: 1;
}

/* 允许 SVG 溢出（画刻度和 brush） */
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
  background: transparent;
}

.brush .selection {
  fill: rgba(0, 120, 215, 0.3);
  stroke: #0078d7;
}
</style>
