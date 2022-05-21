import { Socket } from "net";
import { ProxyAgentOptions, RequestOptions, SocketConnector } from "./agent";

export default class Connector implements SocketConnector{
    connect(proxyOption: ProxyAgentOptions, requestOption: RequestOptions): Promise<Socket> {
        throw new Error("Method not implemented.");
    }
}