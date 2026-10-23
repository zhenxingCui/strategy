import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import { touchActivity, isActivityExpired, clearAuth } from '@/utils/auth'

Vue.use(ElementUI)
Vue.config.productionTip = false

if (process.env.NODE_ENV !== 'production') {
  // 开发环境的无操作超时（10 分钟）重新登录。
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
  setInterval(() => {
    if (isActivityExpired()) {
      expireToLogin()
    }
  }, 30 * 1000)
}

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
