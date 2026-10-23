import Vue from 'vue'
import VueRouter from 'vue-router'
import { isLogin, isActivityExpired, touchActivity, clearAuth, ensureLocalDevelopmentAuth } from '@/utils/auth'

Vue.use(VueRouter)

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Login.vue')
  },
  {
    path: '/',
    redirect: '/strategyReview'
  },
  {
    path: '/strategyReview',
    name: 'StrategyReview',
    component: () => import('@/views/strategyReview/index.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

// 开发构建要求本机身份或有效 IOP 登录；生产包跳过前端登录守卫。
router.beforeEach((to, from, next) => {
  if (process.env.NODE_ENV === 'production') {
    next()
    return
  }
  if ((to.path !== '/login' || !to.query.signToken) && ensureLocalDevelopmentAuth()) {
    next(to.path === '/login' ? '/strategyReview' : undefined)
    return
  }
  if (to.path === '/login') {
    next()
    return
  }
  if (!isLogin()) {
    next('/login')
    return
  }
  // 无操作超时：清除身份并要求从 IOP 重新登录
  if (isActivityExpired()) {
    clearAuth()
    next('/login')
    return
  }
  // 路由跳转视为一次操作，刷新活跃时间戳
  touchActivity()
  next()
})

export default router
