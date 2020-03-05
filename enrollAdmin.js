'use strict';

/*
 * 组织管理员的注册
 *
 * updated by zhongliwen
 * updated at 2020-3-5
 */
var Fabric_Client = require('fabric-client');
var Fabric_CA_Client = require('fabric-ca-client');

var path = require('path');
var util = require('util');
var os = require('os');

// 下面配置信息根据实际情况进行修改
var options = {
    // ca服务器的地址
    ca_network_url: 'http://192.168.31.20:7054',
    // ca服务器的服务名
    ca_host_name: 'ca.example.com',
    // ca服务器的管理员账号ID
    ca_admin_id: 'admin',
    // ca服务器的管理员账号密码
    ca_admin_pwd: '123456',
    // 注册用户的ID
    org_admin_id: 'admin',
    // 注册用户所在组织的MSPID
    org_admin_msp_id: 'Org1MSP',
};

// 创建Fabric客户端
var fabric_client = new Fabric_Client();
// 创建Fabric_CA_Client实例
var fabric_ca_client = null;
// 管理员用户
var admin_user = null;
// 获取hfc-key-store文件夹路径
var store_path = path.join(__dirname, 'hfc-key-store');
console.log(' Store path:'+store_path);

// 创建IKeyValueStore实例
Fabric_Client.newDefaultKeyValueStore({
    path: store_path
}).then((state_store) => {
    // 将keystore分配给fabric客户端
    fabric_client.setStateStore(state_store);

    var crypto_suite = Fabric_Client.newCryptoSuite();
    // use the same location for the state store (where the users' certificate are kept)
    // and the crypto store (where the users' keys are kept)
    // 对状态存储（保存用户证书的位置）和加密存储（保存用户密钥的位置）使用相同的位置
    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
    crypto_suite.setCryptoKeyStore(crypto_store);
    fabric_client.setCryptoSuite(crypto_suite);

    var	tlsOptions = {
    	trustedRoots: [],
    	verify: false
    };
    // be sure to change the http to https when the CA is running TLS enabled
    // 当CA运行启用TLS时，请确保将http更改为https
    fabric_ca_client = new Fabric_CA_Client(options.ca_network_url
        , tlsOptions , options.ca_host_name, crypto_suite);

    // first check to see if the admin is already enrolled
    // 首先检查管理员是否已注册，如果管理员还没有注册，则进行注册
    return fabric_client.getUserContext(org_admin_id, true);
}).then((user_from_store) => {
    if (user_from_store && user_from_store.isEnrolled()) {
        console.log('Successfully loaded admin from persistence');
        admin_user = user_from_store;
        return null;
    } else {
        // need to enroll it with CA server
        // 登录CA服务器
        return fabric_ca_client.enroll({
          enrollmentID: options.ca_admin_id, // 注册ID
          enrollmentSecret: options.ca_admin_pwd // 注册密码
        }).then((enrollment) => {
          console.log('Successfully enrolled admin user "admin"');
          // 创建Org1组织的管理员的私钥和证书文件
          return fabric_client.createUser({
              username: options.org_admin_id,
              mspid: options.org_admin_msp_id,
              cryptoContent: {
                 privateKeyPEM: enrollment.key.toBytes(),
                 signedCertPEM: enrollment.certificate
              }
          });
        }).then((user) => {
          admin_user = user;
          return fabric_client.setUserContext(admin_user);
        }).catch((err) => {
          console.error('Failed to enroll and persist admin. Error: ' + err.stack ? err.stack : err);
          throw new Error('Failed to enroll admin');
        });
    }
}).then(() => {
    console.log('Assigned the admin user to the fabric client ::' + admin_user.toString());
}).catch((err) => {
    console.error('Failed to enroll admin: ' + err);
});