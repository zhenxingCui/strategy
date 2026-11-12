// Local-only visual test proxy: existing UI plus the isolated test backend.
const http = require('http')
http.createServer((req,res)=>{
  const port=req.url.startsWith('/plan-svc-lj')?18082:8081
  const upstream=http.request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:'+port}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)})
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end('Test upstream unavailable')})
  req.pipe(upstream)
}).listen(18081,'127.0.0.1',()=>console.log('Photo trial UI: http://127.0.0.1:18081/strategyReview'))
