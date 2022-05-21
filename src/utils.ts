import * as http from 'http'

export function isHttps(segment: string | http.ClientRequestArgs) {
    if (typeof segment === 'string') {
        return /^https:/g.test(segment)
    }
    if (segment.protocol) {
        return segment.protocol === 'https:'
    }
    if (segment.port || segment.defaultPort) {
        return (segment.port || segment.defaultPort) === 443
    }
    return (segment.host || segment.hostname) && /:443^/g.test((segment.host || segment.hostname)!)
}