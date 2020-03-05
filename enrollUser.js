'use strict';

/*
 * 组织普通会员的注册
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
    // 组织管理员ID
    org_admin_id: 'admin',
    // 新用户的ID
    enroll_user_id: 'user3',
    // 新用户的附属，自己指定
    enroll_user_affiliation: 'org1.department1',
    // 新用户所属组织的MSPID
    enroll_user_org_mspid: 'Org1MSP',
};

// 创建客户端句柄
var fabric_client = new Fabric_Client();
// 创建ca客户端句柄
var fabric_ca_client = null;
// 管理员用户
var admin_user = null;
// 普通用户
var member_user = null;
// 获取证书目录的路径
var store_path = path.join(__dirname, 'hfc-key-store');
console.log(' Store path:'+store_path);

// 创建IKeyValueStore实例
Fabric_Client.newDefaultKeyValueStore({
    path: store_path
}).then((state_store) => {
    // assign the store to the fabric client
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
    // 创建ca客户端（当CA运行启用TLS时，请确保将http更改为https）
    fabric_ca_client = new Fabric_CA_Client(options.ca_network_url, null , '', crypto_suite);

    // first check to see if the admin is already enrolled
    // 首先检查管理员是否已注册，如果管理员还没有注册，则进行注册
    return fabric_client.getUserContext(options.org_admin_id, true);
}).then((user_from_store) => {
    // 判断用户是否存在，以及是否已经登录
    if (user_from_store && user_from_store.isEnrolled()) {
        console.log('Successfully loaded admin from persistence');
        admin_user = user_from_store;
    } else {
        throw new Error('Failed to get admin.... run enrollAdmin.js');
    }

    // at this point we should have the admin user
    // 这里我们应该应景获得了admin用户
    // first need to register the user with the CA server
    // 首先需要向ca服务器注册用户，注册成功后返回
    return fabric_ca_client.register({
        enrollmentID: options.enroll_user_id, // 注册用户的ID
        affiliation: options.enroll_user_affiliation // 注册用户所属的组织部门，自己指定
    }, admin_user);
}).then((secret) => {
    // 然后使用新创建的用户登录ca服务器
    console.log('Successfully registered user - secret:'+ secret);
    return fabric_ca_client.enroll({
        enrollmentID: options.enroll_user_id, // 登录用户的ID
        enrollmentSecret: secret // user的身份证明
    });
}).then((enrollment) => {
    console.log('Successfully enrolled member user" ');
    // 创建user用户的私钥和证书文件
    return fabric_client.createUser({
        username: options.enroll_user_id,
        mspid: options.enroll_user_org_mspid,
        cryptoContent: {
            privateKeyPEM: enrollment.key.toBytes(), // 用户的私钥
            signedCertPEM: enrollment.certificate // 用户的证书
        }
    });
}).then((user) => {
    member_user = user;
    return fabric_client.setUserContext(member_user);
}).then(()=>{
    console.log('user was successfully registered and enrolled and is ready to intreact with the fabric network');
}).catch((err) => {
    console.error('Failed to register: ' + err);
    if(err.toString().indexOf('Authorization') > -1) {
        console.error('Authorization failures may be caused by having admin credentials from a previous CA instance.\n' +
            'Try again after deleting the contents of the store directory '+store_path);
    }
});