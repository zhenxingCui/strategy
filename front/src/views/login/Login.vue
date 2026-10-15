<template>
  <div class="login-guide">
    <!-- 过渡态：解析成功，正在进入系统 -->
    <div v-if="state === 'entering'" class="guide-state">
      <i class="el-icon-loading guide-icon" />
      <div class="guide-text">正在进入系统…</div>
    </div>

    <!-- 失败态：无 token / 解析失败 / timestamp 超时，仅静态提示 -->
    <div v-else-if="state === 'denied'" class="guide-state">
      <i class="el-icon-lock guide-icon guide-icon-warn" />
      <div class="guide-text">无法访问应用，请从 IOP 平台登录</div>
      <div class="guide-sub">本系统不支持直接访问，请从 IOP 平台重新进入</div>
    </div>
  </div>
</template>

<script>
import { decodeBase64 } from '@/utils/base64Util'
import { strDec } from '@/utils/desEnc'
import { setAuth } from '@/utils/auth'

// token 有效期（毫秒）：5 分钟
const TOKEN_TTL = 5 * 60 * 1000

export default {
  name: 'LoginGuide',
  data () {
    return {
      state: 'entering' // entering | denied
    }
  },
  created () {
    this.handleSignToken()
  },
  methods: {
    handleSignToken () {
      const signToken = this.$route.query.signToken
      if (!signToken) {
        this.state = 'denied'
        return
      }
      let params = ''
      try {
        params = decodeBase64(signToken)
      } catch (e) {
        this.state = 'denied'
        return
      }
      // 还原 cityId=xxx&userId=xxx&timestamp=xxx
      const kv = {}
      String(params).split('&').forEach(item => {
        const idx = item.indexOf('=')
        if (idx > -1) {
          kv[item.substring(0, idx)] = item.substring(idx + 1)
        }
      })
      const cityId = kv.cityId ? decodeURIComponent(kv.cityId) : ''
      const userIdCipher = kv.userId || ''
      const timestamp = Number(kv.timestamp)

      if (!cityId || !userIdCipher) {
        this.state = 'denied'
        return
      }
      // 有效期校验：|当前时间 - timestamp| ≤ 5 分钟，缺失/非法/超时均视为无效
      if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > TOKEN_TTL) {
        this.state = 'denied'
        return
      }
      let userId = ''
      try {
        userId = strDec(userIdCipher)
      } catch (e) {
        this.state = 'denied'
        return
      }
      if (!userId) {
        this.state = 'denied'
        return
      }
      setAuth(cityId, userId)
      this.$router.replace('/')
    }
  }
}
</script>

<style scoped>
.login-guide {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.guide-state {
  text-align: center;
}
.guide-icon {
  font-size: 44px;
  color: #2563eb;
}
.guide-icon-warn {
  color: #f59e0b;
}
.guide-text {
  margin-top: 14px;
  font-size: 15px;
  color: #303133;
  font-weight: 600;
}
.guide-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}
</style>
