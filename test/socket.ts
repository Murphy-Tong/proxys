import {SocketChain} from '../src/pool'
import {Socket} from "net";
import {promisify} from "util";

test("队列顺序", function () {
    const chain = new SocketChain()
    const socket = new Socket();
    const socket2 = new Socket();
    const socket3 = new Socket();
    const socket4 = new Socket();
    chain.alloc(socket)
    chain.alloc(socket2)
    chain.alloc(socket3)
    chain.alloc(socket4)
    expect(chain.use()).toBe(socket)
    expect(chain.use()).toBe(socket2)
    expect(chain.use()).toBe(socket3)
    expect(chain.use()).toBe(socket4)
    expect(chain.use()).toBe(undefined)
})

test("队列顺序,全部超时", function () {
    const chain = new SocketChain({timeout: 0})
    const socket = new Socket();
    const socket2 = new Socket();
    const socket3 = new Socket();
    const socket4 = new Socket();
    chain.alloc(socket)
    chain.alloc(socket2)
    chain.alloc(socket3)
    chain.alloc(socket4)
    expect(chain.use()).toBe(undefined)
    expect(chain.use()).toBe(undefined)
    expect(chain.use()).toBe(undefined)
    expect(chain.use()).toBe(undefined)
    expect(chain.use()).toBe(undefined)
    expect(chain.use()).toBe(undefined)
    // expect(chain.use()).toBe(socket)
    // expect(chain.use()).toBe(socket2)
    // setTimeout(function (){
    //     expect(chain.use()).toBe(socket3)
    //
    // },1000)
    // setTimeout(function (){
    //     expect(chain.use()).toBeUndefined()
    // },4000)
})


test("队列顺序,超时", async function () {
    const chain = new SocketChain({timeout: 500})
    const socket = new Socket();
    const socket2 = new Socket();
    const socket3 = new Socket();
    const socket4 = new Socket();
    chain.alloc(socket)
    chain.alloc(socket2)
    await promisify(setTimeout)(1000)
    chain.alloc(socket3)
    chain.alloc(socket4)
    expect(chain.use()).toBe(socket3)
    expect(chain.use()).toBe(socket4)
    await promisify(setTimeout)(1000)
    expect(chain.use()).toBe(undefined)
},11000)

test('销毁', async () => {
    const chain = new SocketChain()
    expect(chain.use()).toBeUndefined();
    const socket = new Socket();
    const socket2 = new Socket();
    chain.alloc(socket)
    chain.alloc(socket2)
    expect(chain.use()).toBe(socket);
    expect(chain.use()).toBe(socket2);
    expect(chain.use()).toBeUndefined();
    socket.destroy()
    expect(chain.use()).toBeUndefined();

    const socket3 = new Socket();
    chain.alloc(socket3)
    const socket4 = new Socket();
    chain.alloc(socket4)
    socket3.destroy()
    await promisify(setTimeout)(1000)
    expect(chain.use()).toBe(socket4);
    expect(chain.use()).toBeUndefined();

    const socket5 = new Socket();
    chain.alloc(socket5)
    const socket6 = new Socket();
    chain.alloc(socket6)
    socket5.emit('error',new Error('test error'))
    await promisify(setTimeout)(1000)
    expect(chain.use()).toBe(socket6);
    expect(chain.use()).toBeUndefined();

    const socket7 = new Socket();
    chain.alloc(socket7)
    socket7.setTimeout(200)
    await promisify(setTimeout)(1000)
    expect(chain.use()).toBeUndefined();

});