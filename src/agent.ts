import * as http from 'http'
import * as https from 'https'
import { Socket } from 'net'
import HttpConnector from './httpProxyServerConnector'
import HttpsConnector from './httpsProxyServerConnector'
import Socks5Connector from './socks5ProxyServerConnector'
import { isHttps } from './utils'


export type SocketCreatedCallback = (err: Error | null, socket: Socket | null) => void

export type ProxyProtocol = 'http:' | 'https:' | 'socks5:'

export type ProxyAgentOptions = {
    proxyHostname: string,
    /**
     * default 80 if protocol is http ,or 
     */
    proxyPort?: number,
    /**
     * default http
     */
    proxyProtocol?: ProxyProtocol,
    /**
     * default 2000
     */
    proxyConnnectTimeout?: number,

    internalPool?: boolean
}

export type ProxyOptionsInternal = (Required<ProxyAgentOptions> & https.AgentOptions) | (Required<ProxyAgentOptions> & https.AgentOptions)

export type RequestOptions = {
    hostname: string,
    /**
     * default 80 if protocol is http ,or 
     */
    port: number,
    /**
     * defahlt /
     */
    path?: string,
    /**
     * default http
     */
    protocol: string,

}

const DEFAULT_OPTIONS = {
    proxyPort: 80,
    proxyProtocol: 'http:' as ProxyProtocol,
    proxyConnnectTimeout: 2000,
    internalPool: false,
}

export const SEGMENT_END_CHAR = Buffer.from('\r\n\r\n')

export interface SocketConnector {
    connect(proxyOption: ProxyAgentOptions, requestOption: RequestOptions): Promise<Socket>
}

/**
 * 负责创建连接到代理服务器的socket
 */
class ProxyAgent {
    options: ProxyOptionsInternal
    socketConnector: SocketConnector

    constructor(options: ProxyOptionsInternal, connector: SocketConnector) {
        this.options = { ...options }
        this.socketConnector = connector
    }

    private async _createConnection(options: http.ClientRequestArgs) {
        const { host, hostname, port, defaultPort } = options
        const isHttpsRequest = isHttps(options)
        const reqOptions: RequestOptions = {
            hostname: hostname || host?.split(':')[0]!,
            port: Number(port || defaultPort || (isHttpsRequest ? 443 : 80)),
            protocol: isHttpsRequest ? 'https:' : 'http:'
        }
        return this.socketConnector.connect(this.options, reqOptions)
    }

    /**
     * 返回链接上了目标服务器的代理socket
     * options： 目标服务器的参数
     */
    async createConnection(options: http.ClientRequestArgs | RequestOptions, callback?: SocketCreatedCallback) {
        return this._createConnection(options).then((socket => {
            callback?.(null, socket)
            return socket
        })).catch(e => {
            callback?.(e, null)
            return e
        })
    }
}


function createAgent(options: ProxyOptionsInternal, protocol: ProxyProtocol) {
    let connector
    switch (protocol) {
        case 'http:':
            connector = new HttpsConnector()
            break;
        case 'https:':
            connector = new HttpsConnector()
            break;
        case 'socks5:':
            connector = new Socks5Connector()
            break;
        default:
            throw new Error('proxy protocol not support')
    }
    return new ProxyAgent(options, connector)
}

class HttpProxyAgent extends http.Agent {
    agent: ProxyAgent
    constructor(options: ProxyAgentOptions & http.AgentOptions) {
        super(options)
        this.agent = createAgent({
            ...DEFAULT_OPTIONS,
            ...options
        }, 'http:')
    }

    createConnection(options: http.ClientRequestArgs, callback: SocketCreatedCallback) {
        this.agent.createConnection(options, callback)
    }
}



class HttpsProxyAgent extends https.Agent {
    agent: ProxyAgent
    constructor(options: ProxyAgentOptions & https.AgentOptions) {
        super(options)
        this.agent = createAgent({
            ...DEFAULT_OPTIONS,
            ...options
        }, 'https:')
    }

    createConnection(options: http.ClientRequestArgs, callback: SocketCreatedCallback) {
        this.agent.createConnection(options, callback)
    }
}


export {
    HttpProxyAgent,
    HttpsProxyAgent,
    ProxyAgent,
    createAgent
}
