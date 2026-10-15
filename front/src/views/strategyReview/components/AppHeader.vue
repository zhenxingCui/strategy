<template>
  <header class="app-header">
    <div class="header-top">
      <div class="header-left">
        <div class="logo">策</div>
        <div class="header-title">策略复盘与预警</div>
      </div>
    </div>
    <nav class="tabs-nav">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="$emit('tabChange', tab.key)"
      >
        {{ tab.label }}
      </div>
    </nav>
  </header>
</template>

<script>
export default {
  name: 'AppHeader',
  props: {
    activeTab: {
      type: String,
      default: 'active'
    },
    dateRange: {
      type: Array,
      default: () => []
    }
  },
  data () {
    return {
      tabs: [
        { key: 'active', label: '主动策略（我找客户）' },
        { key: 'passive', label: '被动策略（客户找我）' },
        { key: 'control', label: '控损策略（控损挽留）' }
      ],
      innerRange: []
    }
  },
  watch: {
    dateRange: {
      handler (val) {
        this.innerRange = val && val.length === 2 ? [...val] : []
      },
      immediate: true,
      deep: true
    }
  },
  methods: {
    handleRangeChange (val) {
      this.$emit('dateRangeChange', val || [])
    }
  }
}
</script>

<style lang="less" scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  .header-top {
    display: flex;
    align-items: center;
    height: 44px;
    padding: 0 16px;
    border-bottom: 1px solid #f3f4f6;
    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
      .logo {
        width: 22px;
        height: 22px;
        border-radius: 4px;
        background: #2563eb;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .header-title {
        font-size: 14px;
        font-weight: 600;
        color: #111827;
      }
    }
  }
  .tabs-nav {
    display: flex;
    padding: 0 16px;
    .tab-item {
      position: relative;
      padding: 8px 14px;
      font-size: 12px;
      color: #6b7280;
      cursor: pointer;
      transition: color 0.15s;
      &.active {
        color: #2563eb;
        font-weight: 600;
        &::after {
          content: '';
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 0;
          height: 2px;
          background: #2563eb;
          border-radius: 1px;
        }
      }
      &:hover {
        color: #2563eb;
      }
    }
  }
}
</style>
