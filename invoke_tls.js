'use strict';

/*
 * 启动tls验证的交易
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
    // 由于实例化链码时候使用了AND('Org1MSP.member', 'Org2MSP.member')的背书策略
    // 所以需要指定两个org1和org2组织的任意节点作为背书节点
    // 节点地址
    peer0_org1_network_url: 'grpcs://192.168.31.20:7051',
    peer0_org2_network_url: 'grpcs://192.168.31.20:9051',
    orderer_network_url: 'grpcs://192.168.31.20:7050',
    // 本地节点证书的位置
    peer0_org1_tls_cacerts:'/home/zhongliwen/hyperledger-febric/ca/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt',
    peer0_org2_tls_cacerts:'/home/zhongliwen/hyperledger-febric/ca/crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt',
    orderer_tls_cacerts:'/home/zhongliwen/hyperledger-febric/ca/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt',
    // 节点服务器的名称
    peer0_org1_server_hostname: "peer0.org1.example.com",
    peer0_org2_server_hostname: "peer0.org2.example.com",
    orderer_server_hostname: "orderer.example.com",
    // 操作用户ID
    oper_user_id: "user3",
    // 调用合约的方法名
    fcn: 'invoke',
    // 方法参数
    args: ['a', 'b', '10'],
    // 事件节点地址
    event_network_url: '192.168.31.20:7051',
};

// 创建客户端句柄
var fabric_client = new Fabric_Client();

// 创建通道
var channel = fabric_client.newChannel(options.channel_id);

// 创建org1组织的peer0节点，并添加到通道中
let data = fs.readFileSync(options.peer0_org1_tls_cacerts);
var peer = fabric_client.newPeer(options.peer0_org1_network_url, {
    pem: Buffer.from(data).toString(),
    'ssl-target-name-override': options.peer0_org1_server_hostname
});
channel.addPeer(peer);

// 创建org2组织的peer0节点，并添加到通道中
let data2 = fs.readFileSync(options.peer0_org2_tls_cacerts);
var peer2 = fabric_client.newPeer(options.peer0_org2_network_url, {
    pem: Buffer.from(data2).toString(),
    'ssl-target-name-override': options.peer0_org2_server_hostname
});
channel.addPeer(peer2);

// 创建orderer节点，并添加到通道中
let odata = fs.readFileSync(options.orderer_tls_cacerts);
var order = fabric_client.newOrderer(options.orderer_network_url, {
    'pem': Buffer.from(odata).toString(),
    'ssl-target-name-override': options.orderer_server_hostname
})
channel.addOrderer(order);

// 获取hfc-key-store的存储路径
var store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:'+store_path);

// 交易ID
var tx_id = null;

// 创建IKeyValueStore实例
Fabric_Client.newDefaultKeyValueStore({
    path: store_path
}).then((state_store) => {
    // 将state_store绑定到client中
    fabric_client.setStateStore(state_store);
    // 创建ICryptoSuite实例
    var crypto_suite = Fabric_Client.newCryptoSuite();
    var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
    crypto_suite.setCryptoKeyStore(crypto_store);
    // 将ICryptoSuite实例绑定到client中
    fabric_client.setCryptoSuite(crypto_suite);
    // 获取登录用户user3
    return fabric_client.getUserContext(options.oper_user_id, true);
}).then((user_from_store) => {
    // 判断user是否存在，以及是否已经登录
    if (user_from_store && user_from_store.isEnrolled()) {
        console.log('Successfully loaded user from persistence');
    } else {
        throw new Error('Failed to get user.... run enrollUser.js');
    }

    // 根据当前用户创建一个交易的ID
    tx_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", tx_id._transaction_id);

    // 构建请求体
    var request = {
        txId: tx_id,
        chainId: options.channel_id,
        chaincodeId: options.chaincode_id,
        fcn: options.fcn, // 调用合约的方法名
        args: options.args, // 方法参数，是一个数组
    };

    // 发送交易请求
    return channel.sendTransactionProposal(request);
}).then((results) => {
    var proposalResponses = results[0];
    var proposal = results[1];
    let isProposalGood = false;
    // 只有当交易响应状态为200时，代表交易成功
    if (proposalResponses && proposalResponses[0].response &&
        proposalResponses[0].response.status === 200) {
        isProposalGood = true;
        console.log('Transaction proposal was good');
    } else {
        console.error('Transaction proposal was bad');
    }

    if (isProposalGood) {
        console.log(util.format(
            'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
            proposalResponses[0].response.status, proposalResponses[0].response.message));

        // build up the request for the orderer to have the transaction committed
        // 构建请求体，把交易数据打包后提交给orderer节点
        var request = {
            proposalResponses: proposalResponses,
            proposal: proposal
        };

        // set the transaction listener and set a timeout of 30 sec
        // 设置交易监听器，监听事件为30秒
        // if the transaction did not get committed within the timeout period,
        // report a TIMEOUT status
        // 如果交易在30秒内没有处理，则返回TIMEOUT状态信息
        var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
        var promises = [];

        var sendPromise = channel.sendTransaction(request);
        promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

        // get an eventhub once the fabric client has a user assigned. The user
        // is required bacause the event registration must be signed
        // 一般fabric客户端分配了用户，就会得到一个ChannelEventHub实例.
        // 因为需要对事件注册进行签名，所以用户是必须的。
        let event_hub = channel.newChannelEventHub(options.event_network_url);
        console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());

        // using resolve the promise so that result status may be processed
        // under the then clause rather than having the catch clause process
        // the status
        let txPromise = new Promise((resolve, reject) => {
            // 设置事件中心的连接超时时间
            let handle = setTimeout(() => {
                event_hub.disconnect();
                resolve({event_status : 'TIMEOUT'});
            }, 30000);
            // 连接事件中心
            event_hub.connect();
            // 注册交易事件监听，当交易被peer提交到账本中时可以得到反馈
            event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                // this is the callback for transaction event status
                // 这是交易事件状态的响应处理函数
                // first some clean up of event listener
                // 首先清除一些事件监听器
                clearTimeout(handle);
                // 解除事件监听
                event_hub.unregisterTxEvent(transaction_id_string);
                // 断开事件中心连接
                event_hub.disconnect();
                // 通知应用程序执行结果
                var return_status = {event_status : code, tx_id : transaction_id_string};
                if (code !== 'VALID') {
                    resolve(return_status);
                } else {
                    resolve(return_status);
                }
            }, (err) => {
                // 事件注册或事件处理失败的处理方法
                reject(new Error('There was a problem with the eventhub: ' + err));
            });
        });
        promises.push(txPromise);
        return Promise.all(promises);
    } else {
        console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
    }
}).then((results) => {
    console.log('Send transaction promise and event listener promise have completed');
    // check the results in the order the promises were added to the promise all list
    if (results && results[0] && results[0].status === 'SUCCESS') {
        console.log('Successfully sent transaction to the orderer.');
    } else {
        console.error('Failed to order the transaction. Error code: ' + response.status);
    }

    if(results && results[1] && results[1].event_status === 'VALID') {
        console.log('Successfully committed the change to the ledger by the peer');
    } else {
        console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
    }
}).catch((err) => {
    console.error('Failed to invoke successfully :: ' + err);
});