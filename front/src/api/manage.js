import axios from 'axios'
import { Message } from 'element-ui'

// 判断请求是否成功：兼容 status 的多种序列化形式
// 枚举名('SUCCESS') / 状态码(200) / 对象({ code: 200 })
function isSuccess (status) {
  if (status == null) return true
  if (typeof status === 'string') return status === 'SUCCESS'
  if (typeof status === 'number') return status === 200 || status === 0
  if (typeof status === 'object') {
    const code = status.code != null ? status.code : status.value
    return code === 200 || code === 0
  }
  return false
}

const service = axios.create({
  timeout: 60000
})

// 请求拦截器
service.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
)

// 响应拦截器：统一解包后端 ActionResponse 结构 { status, data, message }
service.interceptors.response.use(
  response => {
    const result = response.data
    // 标准 ActionResponse 包装
    if (result && typeof result === 'object' && 'status' in result) {
      if (isSuccess(result.status)) {
        return result.data
      }
      const msg = result.message || '请求失败'
      Message.error(msg)
      return Promise.reject(new Error(msg))
    }
    return result
  },
  error => {
    const data = error.response && error.response.data
    const msg = (data && data.message) || error.message || '网络异常'
    Message.error(msg)
    return Promise.reject(error)
  }
)

export function postAction (url, parameter) {
  return service({
    url,
    method: 'post',
    data: parameter
  })
}

export function getAction (url, parameter) {
  return service({
    url,
    method: 'get',
    params: parameter
  })
}