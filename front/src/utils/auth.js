/**
 * 登录身份存取（sessionStorage，关浏览器/标签页即失效）
 * key 前缀 sr_ 避免与其他应用冲突
 */
const CITY_KEY = 'sr_cityId'
const USER_KEY = 'sr_userId'
const LAST_ACTIVE_KEY = 'sr_lastActive'

/** 开发登录无操作有效期（毫秒）：10 分钟 */
export const ACTIVITY_TTL = 10 * 60 * 1000

/** 本机开发免登录：生产构建和非 loopback 域名不启用。 */
export function ensureLocalDevelopmentAuth () {
  if (process.env.NODE_ENV !== 'development' || process.env.VUE_APP_LOCAL_LOGIN !== 'true') return false
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname)) return false
  const legacyLocalDefaults = getCityId() === '001' && getUserId() === 'local-review'
  if (!isLogin() || isActivityExpired() || legacyLocalDefaults) {
    setAuth(process.env.VUE_APP_LOCAL_CITY_ID || '999', process.env.VUE_APP_LOCAL_USER_ID || 'root')
  }
  touchActivity()
  return true
}

export function setAuth (cityId, userId) {
  sessionStorage.setItem(CITY_KEY, cityId || '')
  sessionStorage.setItem(USER_KEY, userId || '')
  sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
}

export function getCityId () {
  if (process.env.NODE_ENV === 'production') return '999'
  return sessionStorage.getItem(CITY_KEY) || '999'
}

export function getUserId () {
  if (process.env.NODE_ENV === 'production') return 'root'
  return sessionStorage.getItem(USER_KEY) || 'root'
}

export function isLogin () {
  return !!(sessionStorage.getItem(CITY_KEY) && sessionStorage.getItem(USER_KEY))
}

export function clearAuth () {
  sessionStorage.removeItem(CITY_KEY)
  sessionStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(LAST_ACTIVE_KEY)
}

/** 用户有操作时刷新活跃时间戳（仅在已登录时记录） */
export function touchActivity () {
  if (isLogin()) {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
  }
}

/**
 * 是否已超过无操作有效期
 * 已登录但无时间戳（异常/旧会话）视为已超时，需重新登录
 */
export function isActivityExpired () {
  if (!isLogin()) {
    return false
  }
  const last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY))
  if (!Number.isFinite(last) || last <= 0) {
    return true
  }
  return Date.now() - last > ACTIVITY_TTL
}
