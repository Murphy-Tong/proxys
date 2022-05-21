import * as http from 'http';
import * as net from 'net';
import { Socket } from "net";
import * as tls from 'tls';
import { ProxyOptionsInternal, RequestOptions, SEGMENT_END_CHAR, SocketConnector } from "./agent";
import { isHttps } from "./utils";

export default class Connector implements SocketConnector {

    async connect(proxyOption: ProxyOptionsInternal, requestOption: RequestOptions) {
        const { proxyProtocol, proxyHostname: proxyHost, proxyPort } = proxyOption
        let proxySocket
        if (isHttps(proxyProtocol!)) {
            proxySocket = tls.connect(proxyPort, proxyHost)
        } else {
            proxySocket = net.connect(proxyPort, proxyHost)
        }
        if (proxyOption.keepAlive) {
            proxySocket.setKeepAlive(true)
        }
        try {
            const isHttpsRequest = isHttps(requestOption)
            const [statusCode, respBuffer] = await this.shakeHand(proxySocket, requestOption.hostname, requestOption.port, proxyOption.proxyConnnectTimeout)
            if (respBuffer) {
                proxySocket.destroy()
                return this.createFakerSockerWithData(respBuffer)
            }
            if (statusCode === 200) {
                if (isHttpsRequest) {
                    return this.tlsSocketWrap(requestOption, proxySocket)
                }
                return proxySocket
            }
        } catch (e) {
            proxySocket.destroy()
            throw e
        }
        throw new Error("链接代理服务器失败")
    }

    private socketTimeout(socket: Socket, timeout: number) {
        const tref = setTimeout(() => {
            socket.emit('error', new Error('proxy server connect timeout'))
        }, timeout);
        return function () {
            clearTimeout(tref)
        }
    }

    private async shakeHand(socket: Socket, host: string, port: number, timeoutP: number) {
        return new Promise<[number, Buffer | null]>((resolve, reject) => {
            socket.once('connect', () => {
                const clearTimeoutCallback = this.socketTimeout(socket, timeoutP)
                const end = function () {
                    clear()
                    reject(new Error('peer proxy server end'))
                }
                const timeout = function () {
                    clear()
                    reject(new Error('proxy server connect timeout'))
                }
                const error = function (e: Error) {
                    clear()
                    reject(e)
                }
                const clear = function () {
                    clearTimeoutCallback()
                    socket.off('end', end)
                    socket.off('timeout', timeout)
                    socket.off('error', error)
                }
                socket.once('data', function (buf) {
                    clear()
                    const headerEndIndex = buf.indexOf(SEGMENT_END_CHAR)
                    const headBuf = buf.slice(0, headerEndIndex)
                    if (!headBuf || headBuf.length === 0 || !headBuf.includes(Buffer.from('200'))) {
                        reject(new Error(`proxy server return bad data:${buf.toString()}`))
                        return
                    }
                    const hasBody = buf.length > headBuf.length + SEGMENT_END_CHAR.length
                    resolve([200, hasBody ? buf : null])
                })
                socket.once('timeout', timeout)
                socket.once('error', error)
                socket.once('end', end)

                socket.write(`CONNECT ${host}:${port} HTTP/1.1`)
                socket.write('\r\n')
                socket.write(`Host: ${host}:${port}`)
                socket.write(SEGMENT_END_CHAR)
            })
        })
    }

    private createFakerSockerWithData(data: Buffer) {
        const socket = new Socket({
            readable: true,
            writable: false
        })
        socket.push(data)
        return socket
    }

    private tlsSocketWrap(options: http.ClientRequestArgs, socket: Socket) {
        return tls.connect({ socket, servername: (options.hostname || options.host)! })
    }
}