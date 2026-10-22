<template>
  <div class="echart-wrapper" :style="{ height: height }">
    <div ref="chart" class="echart-container" />
  </div>
</template>

<script>
import * as echarts from 'echarts'

export default {
  name: 'EChart',
  props: {
    option: {
      type: Object,
      required: true
    },
    height: {
      type: String,
      default: '300px'
    },
    loading: {
      type: Boolean,
      default: false
    },
    // 渲染器：默认 svg（低配机器 + 老浏览器下比 canvas 平滑，无逐帧重绘）；个别图表需 canvas 特性时可传 'canvas' 回退
    renderer: {
      type: String,
      default: 'svg'
    }
  },
  data () {
    return {
      chart: null,
      resizeTimer: null
    }
  },
  watch: {
    option: {
      deep: true,
      handler () {
        this.render()
      }
    },
    loading (val) {
      if (!this.chart) return
      if (val) {
        this.chart.showLoading({ text: '加载中...', color: '#2563eb' })
      } else {
        this.chart.hideLoading()
      }
    }
  },
  mounted () {
    this.init()
    this.render()
    window.addEventListener('resize', this.handleResize)
    if (typeof ResizeObserver !== 'undefined') {
      this.containerObserver = new ResizeObserver(this.handleResize)
      this.containerObserver.observe(this.$el)
    }
  },
  beforeDestroy () {
    if (this.containerObserver) this.containerObserver.disconnect()
    if (this.chart) {
      this.chart.dispose()
      this.chart = null
    }
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    window.removeEventListener('resize', this.handleResize)
  },
  methods: {
    init () {
      this.chart = echarts.init(this.$refs.chart, null, { renderer: this.renderer })
      this.chart.on('click', params => this.$emit('click', params))
    },
    render () {
      if (!this.chart || !this.option) return
      // 低配机器优化：关闭动画，减少 canvas 重绘开销；调用方显式开启动画时可覆盖
      const opt = this.option.animation === undefined
        ? Object.assign({}, this.option, { animation: false })
        : this.option
      this.chart.setOption(opt, true)
      if (this.loading) {
        this.chart.showLoading({ text: '加载中...', color: '#2563eb' })
      } else {
        this.chart.hideLoading()
      }
    },
    handleResize () {
      // 防抖：窗口 resize 连续触发时合并为一次重绘
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(() => {
        if (this.chart) this.chart.resize()
      }, 150)
    }
  }
}
</script>

<style scoped>
.echart-wrapper {
  width: 100%;
}
.echart-container {
  width: 100%;
  height: 100%;
}
</style>
