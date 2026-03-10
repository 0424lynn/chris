/**
 * 用法: node generate-hash.js <你的密码>
 * 把输出的 hash 填入 .env 文件对应字段
 */
const bcrypt = require('bcrypt');
const password = process.argv[2];

if (!password) {
  console.error('用法: node generate-hash.js <密码>');
  process.exit(1);
}

bcrypt.hash(password, 12).then(hash => {
  console.log(hash);
});
