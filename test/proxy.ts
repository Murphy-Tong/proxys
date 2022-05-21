// import { Socket } from 'net';
// import * as https from 'http'
// import * as agent from '../src/agent'
// import HttpsConnector from '../src/httpsProxyServerConnector'

// let lastS: any = null

// const proxyAgent = new agent.ProxyAgent({
//     proxyHostname: '120.42.46.226',
//     proxyPort: 6666,
//     proxyProtocol: 'http:',
//     proxyConnnectTimeout: 2000,
//     internalPool: false,
// }, new HttpsConnector())


// async function reqTest() {
//     const req = https.get("http://www.baidu.com", {
//         headers: {
//             'Connection': 'keep-alive'
//         },
//         agent: new agent.HttpProxyAgent({
//             proxyHostname: '120.42.46.226',
//             proxyPort: 6666,
//             proxyProtocol: 'http:',
//             proxyConnnectTimeout: 2000,
//             maxSockets: 1,
//             maxTotalSockets: 1
//         })
//     }, res => {
//         console.log(res.headers)
//         res.on('data', function (buf) {
//             console.log(buf.length)

//         })
//         res.on('end', () => {
//             console.log('end')
//             setTimeout(() => {
//                 reqTest()
//             }, 4000);
//         })
//     })

//     req.on('socket', function (s) {
//         if (lastS) {
//             console.log(lastS === s)
//         }
//         lastS = s
//     })

//     req.end()
// }


// async function reqTest2(socket: Socket) {
//     socket.write('GET / HTTP/1.1')
//     socket.write('\r\n')
//     socket.write('\r\n')
//     socket.once('data', function (buf) {
//         console.log(buf.toString().slice(0, 200))
//         setTimeout(() => {
//             reqTest2(socket)
//         }, 5000);
//     })

// }


// // proxyAgent.createConnection({
// //     host: 'www.baidu.com',
// //     protocol: 'http'
// // }).then((socket) => {
// //     socket.on('error', console.log)
// //     socket.on('end', function () {
// //         console.log('peer end')
// //     })
// //     reqTest(socket)
// // })

// reqTest()
