<template>
  <div class="review-table" :class="{ 'is-fullscreen': fullscreen }">
    <div v-if="title || tools" class="sub-title">
      <span>{{ title }}</span
      ><span class="spacer" /><slot name="actions" />
      <template v-if="tools">
        <button class="btn" @click="toggleFullscreen">
          <i :class="fullscreen ? 'el-icon-close' : 'el-icon-full-screen'" />{{ fullscreen ? '退出全屏' : '全屏' }}
        </button>
        <button
          class="btn"
          :disabled="exporting || !hasExportData"
          title="导出当前筛选条件下的全部数据"
          @click="handleExport"
        >
          <i class="el-icon-download" />{{ exporting ? '导出中…' : '导出全部数据' }}
        </button>
      </template>
    </div>
    <slot name="filters" />
    <review-state :state="state" :empty="!rows.length" :empty-text="emptyText" @retry="$emit('retry')">
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th v-if="selectable" class="selection-cell">
                <input
                  type="checkbox"
                  aria-label="选择当前页全部策略"
                  :checked="rows.length > 0 && selected.length === rows.length"
                  @change="selectAll($event.target.checked)"
                />
              </th>
              <th
                v-for="column in columns"
                :key="column.prop"
                :class="{ num: !column.text }"
                :aria-sort="
                  sortable && !column.text && sortField === column.prop
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : null
                "
              >
                <button v-if="sortable && !column.text" class="th-sort" @click="sort(column.prop)">
                  {{ column.label }}
                  <i
                    :class="
                      sortField === column.prop
                        ? sortDir === 'asc'
                          ? 'el-icon-caret-top'
                          : 'el-icon-caret-bottom'
                        : 'el-icon-sort'
                    "
                  />
                </button>
                <template v-else>{{ column.label }}</template>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in rows"
              :key="rowKey(row, index)"
              :class="{
                'is-picked': rowClickable ? activeRowKey === rowKey(row, index) : activeId && String(row.strategyId) === String(activeId),
                'is-clickable': rowClickable,
              }"
              :tabindex="rowClickable ? 0 : null"
              :aria-selected="rowClickable ? activeRowKey === rowKey(row, index) : null"
              @click="activateRow(row, $event)"
              @keydown="activateRowByKey(row, $event)"
            >
              <td v-if="selectable" class="selection-cell">
                <input
                  type="checkbox"
                  :aria-label="`选择${row.strategyName || row.name || '策略'}`"
                  :checked="selected.includes(index)"
                  @change="selectRow(index, $event.target.checked)"
                />
              </td>
              <td v-for="column in columns" :key="column.prop" :class="{ num: !column.text, 'text-cell': column.text }">
                <button
                  v-if="column.link"
                  class="btn-link strategy-link"
                  :title="cell(row, column)"
                  @click="$emit('strategy', row)"
                >
                  {{ cell(row, column) }}
                </button>
                <span v-else :class="changeClass(row, column)">{{ cell(row, column) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </review-state>
    <div v-if="pagination" class="table-note">
      <span>共 {{ total }} 条</span>
      <el-pagination
        small
        background
        layout="prev, pager, next"
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :pager-count="5"
        @current-change="$emit('page', $event)"
      />
    </div>
  </div>
</template>
<script>
import ReviewState from './ReviewState.vue'
import { numberText } from './reviewData'
import { exportTableToCsv } from '../utils/csvExport'

export default {
  name: 'ReviewTable',
  components: { ReviewState },
  props: {
    title: { type: String, default: '' },
    columns: { type: Array, default: () => [] },
    rows: { type: Array, default: () => [] },
    state: { type: Object, default: () => ({}) },
    page: { type: Number, default: 1 },
    pageSize: { type: Number, default: 10 },
    total: { type: Number, default: 0 },
    activeId: { type: [String, Number], default: '' },
    rowClickable: Boolean,
    getRowKey: { type: Function, default: null },
    activeRowKey: { type: String, default: '' },
    pagination: { type: Boolean, default: true },
    tools: Boolean,
    exporting: Boolean,
    exportData: { type: Array, default: null },
    selectable: Boolean,
    sortable: Boolean,
    emptyText: { type: String, default: '没有符合筛选条件的数据' },
  },
  data() {
    return { fullscreen: false, selected: [], sortField: '', sortDir: 'desc' }
  },
  computed: {
    hasExportData() {
      return Array.isArray(this.exportData) ? this.exportData.length > 0 : this.total > 0 || this.rows.length > 0
    },
  },
  watch: {
    rows() {
      this.selected = []
      this.$emit('selection', [])
    },
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown)
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.onKeydown)
  },
  methods: {
    rowKey(row, index) {
      if (this.getRowKey) return this.getRowKey(row)
      return `${row.strategyId || row.bizCode || row.bigCategory || ''}-${row.channel || ''}-${index}`
    },
    activateRow(row, event) {
      if (!this.rowClickable || event.target.closest('button, input, select, a')) return
      this.$emit('row-click', row)
    },
    activateRowByKey(row, event) {
      if (!this.rowClickable || event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      this.$emit('row-click', row)
    },
    cell(row, col) {
      const value = row[col.prop] == null && col.prop === 'strategyName' ? row.name : row[col.prop]
      if (col.format) return col.format(value, row)
      return col.text ? (value == null || value === '' ? '—' : String(value)) : numberText(value)
    },
    changeClass(row, col) {
      if (!['qoq', 'momRatio'].includes(col.prop) || row[col.prop] == null) return ''
      const value = Number(row[col.prop])
      return value < 0 ? 'up' : value > 0 ? 'down' : ''
    },
    selectRow(index, checked) {
      this.selected = checked ? [...this.selected, index] : this.selected.filter((i) => i !== index)
      this.emitSelection()
    },
    selectAll(checked) {
      this.selected = checked ? this.rows.map((r, i) => i) : []
      this.emitSelection()
    },
    emitSelection() {
      this.$emit(
        'selection',
        this.selected.map((i) => this.rows[i]),
      )
    },
    sort(field) {
      this.sortDir = this.sortField === field && this.sortDir === 'desc' ? 'asc' : 'desc'
      this.sortField = field
      this.$emit('sort', { sortField: field, sortDir: this.sortDir })
    },
    toggleFullscreen() {
      this.fullscreen = !this.fullscreen
      this.$nextTick(() => window.dispatchEvent(new Event('resize')))
    },
    onKeydown(e) {
      if (e.key === 'Escape' && this.fullscreen) this.toggleFullscreen()
    },
    handleExport() {
      if (Array.isArray(this.exportData)) {
        this.exportRows(this.exportData)
        return
      }
      this.$emit('export-all')
    },
    exportRows(data = this.rows) {
      exportTableToCsv({
        columns: this.columns.map((col) => ({ label: col.label, formatter: (row) => this.cell(row, col) })),
        data,
        filename: this.title || '策略复盘',
      })
    },
  },
}
</script>
