<template>
  <div class="review-state-wrap" :aria-busy="!!state.loading">
    <div v-if="state.loading" class="review-state" role="status"><i class="el-icon-loading" /> 正在加载…</div>
    <div v-else-if="state.error" class="review-state error" role="alert">
      <i class="el-icon-warning-outline" />
      <p>{{ state.error }}</p>
      <button class="btn" @click="$emit('retry')">重新加载</button>
    </div>
    <div v-else-if="empty" class="review-state">
      <i class="el-icon-inbox" />
      <p>{{ emptyText }}</p>
    </div>
    <slot v-else />
  </div>
</template>
<script>
export default {
  name: 'ReviewState',
  props: {
    state: { type: Object, default: () => ({}) },
    empty: Boolean,
    emptyText: { type: String, default: '暂无数据' },
  },
}
</script>
