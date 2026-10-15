const path = require('path')

module.exports = {
  publicPath: '/',
  outputDir: 'dist',
  assetsDir: 'static',
  productionSourceMap: false,
  // @ 别名指向 src
  chainWebpack: config => {
    config.resolve.alias.set('@', path.resolve(__dirname, 'src'))
  },
  devServer: {
    // 避开后端 8080 端口
    port: 8081,
    proxy: {
      // 后端 context-path 为 /plan-svc-lj，此处透传不重写路径
      '/plan-svc-lj': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
}