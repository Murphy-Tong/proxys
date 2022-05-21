import {Socket} from 'net';

type Listeners = {
    [key in 'error' | 'end' | 'timeout' | 'close']: any
}
type QueneItem = { socket: Socket, next: QueneItem, pre: QueneItem, expiredTime: number, listeners: Listeners, id: number }

type Queue = QueneItem

export type IOptios = {
    maxSize?: number
    /**
     * -1 never ,0 right now
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
    id = 1

    constructor(options?: IOptios) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options || {}
        }
        this.pool = {} as Queue
        this.initPool()
    }

    private initPool() {
        this.pool = {} as Queue
        this.pool.next = this.pool
        this.pool.pre = this.pool
        this.pool.id = 0
    }

    alloc(socket: Socket) {
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
        return this.peekOne()?.socket
    }

    destroy() {
        this.timeoutRef && clearTimeout(this.timeoutRef)
        this.initPool()
    }

    private ensureTimeoutRunning() {
        if (this.timeoutRef) {
            return
        }
        this.startNextTimeout()
    }

    private startNextTimeout() {
        const first = this.pool.next
        if (!first || first === this.pool || first.expiredTime === -1) {
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
        if (this.options.timeout === -1) {
            return
        }
        let ptr = this.pool.next
        const currentTime = new Date().valueOf()
        while (ptr !== this.pool) {
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
        pre.next = next
        next.pre = pre
        if (error) {
            console.log('removed with error', error)
        }
        return item
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
        return this.remove(this.pool.next)
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
            },
            'close': () => {
                this.remove(item)
            }
        }
        socket?.once('end', item.listeners.end)
        socket?.once('error', item.listeners.error)
        socket?.once('timeout', item.listeners.timeout)
        socket?.once('close', item.listeners.close)
    }

    private generateExpiredTime() {
        if (!(this.options.timeout) || this.options.timeout < 0) {
            return this.options.timeout
        }
        return this.options.timeout + new Date().valueOf()
    }


    private createItem(socket: Socket) {
        Object.defineProperty(socket, "____id", {
            value: this.id
        })
        return {
            socket,
            expiredTime: this.generateExpiredTime(),
            id: this.id++
        } as QueneItem
    }

    private addLast(socket: Socket) {
        if (this.options.timeout === 0) {
            return
        }
        const cur = this.createItem(socket)
        if (this.options.timeout === -1) {
            this.addAfter(this.pool.pre, cur)
        } else {
            this.addAfter(this.findInsertPosition(cur.expiredTime), cur);
        }
        return cur
    }

    private findInsertPosition(time: number) {
        let ptr = this.pool.next
        if (ptr === this.pool) {
            return this.pool
        }
        while (ptr !== this.pool) {
            const next = ptr.next
            if (next === this.pool) {
                return ptr
            }
            if (time >= ptr.expiredTime && time < next.expiredTime) {
                return ptr
            }
            ptr = ptr.next
        }
        return ptr.pre
    }

    private addAfter(pre: QueneItem, cur: QueneItem) {
        const next = pre.next
        pre.next = cur
        cur.next = next
        next.pre = cur
        cur.pre = pre
    }

}
