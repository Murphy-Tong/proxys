import { Socket } from 'net';

type Listeners = {
    [key in 'error' | 'end' | 'timeout']: any
}
type QueneItem = { socket: Socket, next: QueneItem, pre: QueneItem, expiredTime: number, listeners: Listeners }

type Queue = QueneItem

export type IOptios = {
    maxSize?: number
    /**
     * -1 nerver ,0 right now
     */
    timeout?: number
}

const DEFAULT_OPTIONS = {
    maxSize: 2,
    timeout: -1
}

export class SocketChain {
    pool: Queue
    options: IOptios
    timeoutRef: any

    constructor(options?: IOptios) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options || {}
        }
        this.pool = {} as Queue
        this.pool.next = this.pool
        this.pool.pre = this.pool
    }

    alloced(socket: Socket) {
        const item = this.addLast(socket)
        if (!item) {
            return
        }
        this.addCallbacks(item)
        this.startTimeoutFor(item)
    }

    private startTimeoutFor(item: QueneItem) {
        if (this.options.timeout === -1) {
            return
        }
        if (this.options.timeout === 0) {
            this.remove(item)
            return
        }
        this.ensureTimeoutRunning()
    }


    use() {
        return this.peekOne()
    }

    destroy() {
        this.timeoutRef && clearTimeout(this.timeoutRef)
        this.pool = {} as Queue
    }

    private ensureTimeoutRunning() {
        if (this.timeoutRef) {
            return
        }
        this.startNextTimeout()
    }

    private startNextTimeout() {
        const first = this.pool.next
        if (!first || first.expiredTime === -1) {
            return
        }
        const currentTime = new Date().valueOf()
        if (first.expiredTime <= currentTime) {
            this.remove(first)
            this.startNextTimeout()
            return
        }
        if (this.timeoutRef) {
            clearTimeout(this.timeoutRef)
        }
        this.timeoutRef = setTimeout(() => {
            this.removeExpiredItems()
            this.startNextTimeout()
        }, first.expiredTime - currentTime);
    }

    removeExpiredItems() {
        let ptr = this.pool.next
        const currentTime = new Date().valueOf()
        while (ptr) {
            const next = ptr.next
            if (currentTime >= ptr.expiredTime) {
                this.remove(ptr)
            }
            ptr = next
        }
    }


    private remove(item: QueneItem, error?: Error) {
        this.removeCallback(item)
        const pre = item.pre
        const next = item.next
        if (pre === next) {
            this.pool.next = this.pool
            this.pool.pre = this.pool
        } else {
            pre.next = next
            next.pre = pre
        }
        if (error) {
            console.log('remoed with error', error)
        }
    }

    private removeCallback(item: QueneItem) {
        Object.keys(item.listeners).forEach(key => {
            // @ts-ignore
            item.socket.off(key, item.listeners[key])
        })
    }


    private peekOne() {
        if (this.pool.next === this.pool) {
            return null
        }
        return this.pool.next
    }

    private addCallbacks(item: QueneItem) {
        const socket = item.socket
        item.listeners = {
            'end': () => {
                this.remove(item, new Error('peer end'))
            },
            'error': (err: any) => {
                this.remove(item, err as Error)
            },
            'timeout': () => {
                this.remove(item, new Error('timeout'))
            }
        }
        socket?.once('end', item.listeners.end)
        socket?.once('error', item.listeners.error)
        socket?.once('timeout', item.listeners.timeout)
    }

    private generateExpiredTime() {
        if (!(this.options.timeout) || this.options.timeout < 0) {
            return this.options.timeout
        }
        return this.options.timeout + new Date().valueOf()
    }

    private createItem(socket: Socket) {
        return {
            socket,
            expiredTime: this.generateExpiredTime()
        } as QueneItem
    }

    private addLast(socket: Socket) {
        if (this.options.timeout === 0) {
            return
        }
        const cur = this.createItem(socket)
        const last = this.pool.pre
        if (last === this.pool) {
            this.pool.next = cur
            cur.pre = this.pool
            this.pool.pre = cur
            cur.next = this.pool
        } else {
            this.pool.next = cur
            this.pool.pre = cur
            cur.pre = this.pool
            cur.next = this.pool
        }
        return cur
    }
}
