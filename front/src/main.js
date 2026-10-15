import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import { touchActivity, isActivityExpired, clearAuth } from '@/utils/auth'

Vue.use(ElementUI)
Vue.config.productionTip = false

// ===== 无操作超时（10 分钟）强制重新登录 =====
// 用户操作（点击/按键/滚轮/触屏）刷新活跃时间戳；超时后清除身份并引导回 IOP 登录提示页
function expireToLogin () {
  clearAuth()
  router.push('/login')
}
;['click', 'keydown', 'wheel', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => {
    if (isActivityExpired()) {
      expireToLogin()
    } else {
      touchActivity()
    }
  }, { passive: true })
})
// 兜底定时器：页面静置无任何交互时也会到期跳转
setInterval(() => {
  if (isActivityExpired()) {
    expireToLogin()
  }
}, 30 * 1000)

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')