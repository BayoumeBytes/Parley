import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

// Small Engine.IO polling client to exercise the real HTTP/Socket.IO boundary
// with cookies. With an IO instance, inject a memory transport instead. Both
// modes use the real Socket.IO parser, authentication, rooms and event handlers.
export class SocketClient {
  constructor(baseUrl, cookie = "") {
    if (typeof baseUrl !== "string") this.io = baseUrl;
    this.url = `${baseUrl}/socket.io/?EIO=4&transport=polling`;
    this.headers = { Cookie: cookie };
    this.events = [];
    this.waiters = [];
    this.nextId = 0;
    this.abort = new AbortController();
  }

  async connect() {
    if (this.io) {
      this.connection = Object.assign(new EventEmitter(), {
        id: randomUUID(), protocol: 4, readyState: "open",
        request: { headers: { cookie: this.headers.Cookie }, connection: {}, url: "/socket.io/" },
        transport: { writable: true, name: "memory" },
        write: (packet) => this.receive(`4${packet}`),
        close: () => {
          this.connection.readyState = "closed";
          this.connection.emit("close", "transport close");
          this.push("disconnect", undefined);
        },
      });
      this.io.engine.emit("connection", this.connection);
      await this.write("40");
      return this;
    }
    const response = await fetch(this.url, { headers: this.headers });
    const open = await response.text();
    this.url += `&sid=${JSON.parse(open.slice(1)).sid}`;
    await this.write("40");
    this.polling = this.poll();
    return this;
  }

  async write(packet) {
    if (this.io) {
      if (packet === "1") this.connection.close();
      else this.connection.emit("data", packet.slice(1));
      return;
    }
    const response = await fetch(this.url, {
      method: "POST", headers: { ...this.headers, "Content-Type": "text/plain" }, body: packet,
    });
    if (!response.ok) throw new Error(`Socket write failed: ${response.status}`);
  }

  async poll() {
    try {
      while (!this.closed) {
        const response = await fetch(this.url, { headers: this.headers, signal: this.abort.signal });
        if (!response.ok) return;
        for (const packet of (await response.text()).split("\x1e")) {
          if (packet === "2") { await this.write("3"); continue; }
          this.receive(packet);
          if (packet === "1") return;
        }
      }
    } catch (error) {
      if (!this.closed) this.push("transport_error", error.message);
    }
  }

  receive(packet) {
    if (packet === "1" || packet === "41") this.push("disconnect", undefined);
    else if (packet.startsWith("42")) {
      const [event, payload] = JSON.parse(packet.slice(2));
      this.push(event, payload);
    } else if (packet.startsWith("43")) {
      const [, id, data] = packet.match(/^43(\d+)(\[.*)$/s);
      this.push(`ack:${id}`, JSON.parse(data)[0]);
    } else if (packet.startsWith("44")) {
      this.push("connect_error", JSON.parse(packet.slice(2)));
    }
  }

  push(event, payload) {
    const index = this.waiters.findIndex((waiter) => waiter.event === event);
    if (index === -1) this.events.push({ event, payload });
    else this.waiters.splice(index, 1)[0].resolve(payload);
  }

  next(event, timeout = 2000) {
    const index = this.events.findIndex((item) => item.event === event);
    if (index !== -1) return Promise.resolve(this.events.splice(index, 1)[0].payload);
    return new Promise((resolve, reject) => {
      const waiter = { event, resolve: (payload) => { clearTimeout(timer); resolve(payload); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((entry) => entry !== waiter);
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeout);
      this.waiters.push(waiter);
    });
  }

  async emit(event, payload) {
    const id = ++this.nextId;
    const result = this.next(`ack:${id}`);
    await this.write(`42${id}${JSON.stringify([event, payload])}`);
    return result;
  }

  async close() {
    this.closed = true;
    this.abort.abort();
    await this.polling;
    await this.write("1").catch(() => {});
  }
}
