'use strict';

/*
 * 关闭tls验证的查询
 *
 * updated by zhongliwen
 * updated at 2020-3-5
 */
var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');

// 下面配置信息根据实际情况进行修改
var options = {
    // 通道ID
    channel_id: 'testchannel',
    // 合约名称
    chaincode_id: 'testcc',
    // peer0.org1.example.com节点的地址，因为启用了TLS，所以是grpcs,如果没有启用TLS，那么就是grpc
    network_url: 'grpc://192.168.31.20:7051',
    // 操作用户ID
    oper_user_id: "user3",
    // 调用合约的方法名
    fcn: 'query',
    // 方法参数
    args: ['a'],
};

// 创建client句柄
var fabric_client = new Fabric_Client();

// 创建通道
var channel = fabric_client.newChannel(options.channel_id);
// 连接peer0.org1.example.com的peer节点
var peer = fabric_client.newPeer(options.network_url);
// 将节点加入通道
channel.addPeer(peer);
// fabric用户
var member_user = null;

// 用户证书和秘钥保存的路径
var store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:' + store_path);

var tx_id = null;

// 定义查询方法
var query = async (fcn, args)=>{
    try {
        // 创建IKeyValueStore实例
        var state_store = await Fabric_Client.newDefaultKeyValueStore({path: store_path});
        // 将IKeyValueStore绑定客户端
        fabric_client.setStateStore(state_store);
        // 创建ICryptoSuite实例
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // 创建ICryptoKeyStore实例，存储证书的路径与创建IKeyValueStore实例相同
        var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        // 将crypto_store绑定到crypto_suite实例中
        crypto_suite.setCryptoKeyStore(crypto_store);
        // 将ICryptoSuite绑定客户端
        fabric_client.setCryptoSuite(crypto_suite);

        // 获取user用户
        var user_from_store = await fabric_client.getUserContext(options.oper_user_id, true);

        // 判断用户是否已经登录
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user1 from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user.... run enrollUser.js');
        }

        // 构建请求体
        const request = {
            //targets : --- 将请求发送给该属性指定的节点
            chaincodeId: options.chaincode_id, // 合约ID
            fcn: options.fcn, // 调用合约的方法方法名
            args: optioins.args // 方法参数，是一个数组
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

query();
