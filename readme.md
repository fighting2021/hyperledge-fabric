# 操作步骤

第一步：创建项目。
```shell
mkdir fabric-ca-test
cd fabric-ca-test
npm init
```
第二步：安装包。

```shell
npm install --save fabric-ca-client
npm install --save fabric-client
npm install --save grpc
```

第三步：下载js示例文件。

enrollAdmin.js：注册组织管理员；<br/>
enrollUser.js：注册组织的普通会员，注册前必须完成管理员账号的注册；<br/>
query.js：查询数据（关闭了tls功能）；<br/>
query_tls.js：查询数据（开启了tls功能）；<br/>
invoke.js：执行交易（关闭了tls功能）；<br/>
invoke_tls.js：执行交易（开启了tls功能）；<br/>

第四步：根据实际情况修改js文件的options配置信息（比如ip地址、用户ID等等）。
![在这里插入图片描述](https://img-blog.csdnimg.cn/20200305163829353.png?x-oss-process=image/watermark,type_ZmFuZ3poZW5naGVpdGk,shadow_10,text_aHR0cHM6Ly9ibG9nLmNzZG4ubmV0L3pob25nbGl3ZW4xOTgx,size_16,color_FFFFFF,t_70)

第五步：通过`node xxx.js`命令执行相关操作。
```shell
# 注册管理员
node enrollAdmin.js
# 注册用户
node registUser.js
# 查询a的值
node query.js
# 查询a的值(启动了tls功能)
node query_tls.js
# a向b转账10
node invoke.js
# a向b转账10(启动了tls功能)
node invoke_tls.js
```