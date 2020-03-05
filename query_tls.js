'use strict';

/*
 * 启动了tls验证的查询
 *
 * updated by zhongliwen
 * updated at 2020-3-5
 */
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs');

// 下面配置信息根据实际情况进行修改
var options = {
    // 通道ID
    channel_id: 'testchannel',
    // 合约名称
    chaincode_id: 'testcc',
    // peer0.org1.example.com节点的地址，因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc
    network_url: 'grpcs://192.168.31.20:7051',
    // 本地存储证书的位置
    tls_cacerts:'/home/zhongliwen/hyperledger-febric/ca/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt',
    // 主机名
    server_hostname: "peer0.org1.example.com",
    // 操作用户ID
    oper_user_id: "user3",
    // 调用合约的方法名
    fcn: 'query',
    // 方法参数
    args: ['a'],
};

// 创建客户端的句柄
var fabric_client = new Fabric_Client();
// 创建通道
var channel = fabric_client.newChannel(options.channel_id);
// 读取证书数据
let data = fs.readFileSync(options.tls_cacerts);
// 连接peer0.org1.example.com节点
var peer = fabric_client.newPeer(options.network_url, {
    pem: Buffer.from(data).toString(),
    'ssl-target-name-override': options.server_hostname
});
// 将节点添加到通道中
channel.addPeer(peer);

// 获取证书存储路径
var store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:' + store_path);

// 定义查询方法
var query = async (fcn, args)=>{
    try {
        // 创建IKeyValueStore实例
        var state_store = await Fabric_Client.newDefaultKeyValueStore({path: store_path});

        // 将IKeyValueStore绑定客户端
        fabric_client.setStateStore(state_store);

        // 创建ICryptoSuite实例
        var crypto_suite = Fabric_Client.newCryptoSuite();

        // 创建ICryptoKeyStore实例
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});

        // 将crypto_store
        crypto_suite.setCryptoKeyStore(crypto_store);

        // 将ICryptoSuite绑定客户端
        fabric_client.setCryptoSuite(crypto_suite);

        // 获取用户
        var user_from_store = await fabric_client.getUserContext(options.oper_user_id, true);

        // 判断用户是否已经登录
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user from persistence');
        } else {
            throw new Error('Failed to get user.... run enrollUser.js');
        }

        // 构建请求体
        const request = {
            //targets : --- 将请求发送给该属性指定的节点
            chaincodeId: options.chaincode_id,
            fcn: options.fcn, // 调用合约的方法名
            args: options.args // 方法参数
        };

        // 向节点发起查询请求，如果targets指定多个peer节点，则返回的结果可能有多个
        var query_responses = await channel.queryByChaincode(request);
        console.log("Query has completed, checking results");

        // 处理查询结果
        if (query_responses && query_responses.length == 1) {
            if (query_responses[0] instanceof Error) {
                console.error("error from query = ", query_responses[0]);
            } else {
                console.log("Response is ", query_responses[0].toString());
            }
        } else {
            console.log("No payloads were returned from query");
        }
    }catch (err){
        console.error('Failed to query successfully :: ' + err);
    }
};

query()
