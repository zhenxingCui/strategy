<template>
  <section class="section">
    <h2 class="section-title">策略执行情况</h2>
    <div class="split split--m2">
      <div class="card">
        <review-table
          title="策略分类执行情况"
          tools
          :columns="columns"
          :rows="pagedCategories"
          :page="page"
          :total="filteredCategories.length"
          :state="panels.category"
          @page="page = $event"
          @retry="loadCategories"
        >
          <div slot="filters" class="toolbar">
            <select v-model="draftBig" class="select" :aria-label="categoryBigLabel" @change="draftSmall = ''">
              <option value="">全部{{ categoryPrefix }}大类</option>
              <option v-for="name in bigCategories" :key="name">{{ name }}</option>
            </select>
            <select v-model="draftSmall" class="select" :aria-label="categorySmallLabel">
              <option value="">全部{{ categoryPrefix }}小类</option>
              <option v-for="name in smallCategories" :key="name">{{ name }}</option>
            </select>
            <button class="btn btn-primary" @click="search">搜索</button
            ><button class="btn" @click="reset">重置</button>
          </div>
        </review-table>
      </div>
      <div class="card chart-card">
        <div class="sub-title">
          触点产能趋势<span class="spacer" /><span class="muted">{{ channelName }}</span>
        </div>
        <review-state :state="panels.trend" :empty="!trend.length" @retry="loadTrend"
          ><e-chart :option="trendOption" height="285px"
        /></review-state>
      </div>
      <div class="card">
        <review-table
          title="业务产能明细"
          :columns="bizColumns"
          :rows="biz.slice((bizPage - 1) * 5, bizPage * 5)"
          :page="bizPage"
          :total="biz.length"
          :state="panels.biz"
          @page="bizPage = $event"
          @retry="loadBiz"
        />
      </div>
    </div>
  </section>
</template>
<script>
import { getCategorySummary, getChannelCapacityTrend, getChannelBizCapacity } from '@/api/strategyReview'
import EChart from '@/components/EChart.vue'
import ReviewTable from './ReviewTable.vue'
import ReviewState from './ReviewState.vue'
import { listOf, categoryColumns, controlCategoryColumns, channelBizColumns, categoryLabelColumns, barLineOption, panelRequests } from './reviewData'

export default {
  name: 'StockExecution',
  components: { EChart, ReviewTable, ReviewState },
  mixins: [panelRequests],
  props: { query: { type: Object, required: true }, channelName: { type: String, default: '全部渠道' } },
  data() {
    return {
      categories: [],
      trend: [],
      biz: [],
      page: 1,
      bizPage: 1,
      draftBig: '',
      draftSmall: '',
      big: '',
      small: '',
    }
  },
  computed: {
    columns() {
      return categoryLabelColumns(this.query.tabType === 'control' ? controlCategoryColumns : categoryColumns, this.query)
    },
    isDowngrade() {
      return this.query.tabType === 'active' && this.query.strategyClass === 'DOWNGRADE'
    },
    categoryPrefix() {
      return this.isDowngrade ? '场景' : '策略'
    },
    categoryBigLabel() {
      return `${this.categoryPrefix}大类`
    },
    categorySmallLabel() {
      return `${this.categoryPrefix}小类`
    },
    bizColumns() {
      return this.query.tabType === 'control'
        ? channelBizColumns.map(c => c.prop === 'capacity' ? { ...c, label: '成功量' } : c)
        : channelBizColumns
    },
    bigCategories() {
      return [...new Set(this.categories.map((r) => r.bigCategory).filter(Boolean))]
    },
    smallCategories() {
      return [
        ...new Set(
          this.categories
            .filter((r) => !this.draftBig || r.bigCategory === this.draftBig)
            .map((r) => r.smallCategory)
            .filter(Boolean),
        ),
      ]
    },
    filteredCategories() {
      return this.categories.filter(
        (r) => (!this.big || r.bigCategory === this.big) && (!this.small || r.smallCategory === this.small),
      )
    },
    pagedCategories() {
      return this.filteredCategories.slice((this.page - 1) * 5, this.page * 5)
    },
    trendOption() {
      return barLineOption(
        this.trend.map((r) => r.monthLabel || r.month),
        this.trend.map((r) => r.capacity),
        this.trend.map((r) => r.qoq),
        '产能',
      )
    },
  },
  watch: {
    query: {
      deep: true,
      handler() {
        this.reset()
        this.load()
      },
    },
  },
  created() {
    this.load()
  },
  methods: {
    load() {
      this.loadCategories()
      this.loadTrend()
      this.loadBiz()
    },
    loadCategories() {
      return this.request(
        'category',
        () => getCategorySummary(this.query),
        (result) => {
          this.categories = listOf(result)
          this.page = 1
        },
      )
    },
    loadTrend() {
      return this.request(
        'trend',
        () => getChannelCapacityTrend(this.query),
        (result) => {
          this.trend = listOf(result)
        },
      )
    },
    loadBiz() {
      return this.request(
        'biz',
        () => getChannelBizCapacity(this.query),
        (result) => {
          this.biz = listOf(result)
          this.bizPage = 1
        },
      )
    },
    search() {
      this.big = this.draftBig
      this.small = this.draftSmall
      this.page = 1
    },
    reset() {
      this.big = ''
      this.small = ''
      this.draftBig = ''
      this.draftSmall = ''
      this.page = 1
    },
  },
}
</script>
