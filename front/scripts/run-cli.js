/**
 * Vue CLI 版本自适应启动器
 * Node 17+ 需要 --openssl-legacy-provider（webpack4 的 md4 哈希依赖 OpenSSL legacy 算法）
 * Node 14/16 不支持该 flag，直接运行
 * 用法：node scripts/run-cli.js serve | build | ...
 */
const { spawn } = require('child_process');

const major = Number(process.versions.node.split('.')[0]);
const args = [];
if (major >= 17) {
  args.push('--openssl-legacy-provider');
}
// 定位 @vue/cli-service 实际入口，避免依赖 .bin shim
args.push(require.resolve('@vue/cli-service/bin/vue-cli-service.js'));
args.push(...process.argv.slice(2));

const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code));
