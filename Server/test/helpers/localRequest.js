import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

// Dispatch actual HTTP requests through the attached Express/Engine.IO handlers
// without binding a port. REALTIME_NETWORK=1 switches the suite to supertest.
export function localRequest(server) {
  const make = (method, url) => {
    const headers = {};
    let body;
    return {
      set(name, value) { headers[name.toLowerCase()] = value; return this; },
      send(value) { body = value; return this; },
      async expect(status) {
        const result = await new Promise((resolve, reject) => {
          const req = new IncomingMessage(new Socket());
          req.method = method;
          req.url = url;
          req.headers = headers;
          const data = body == null ? "" : JSON.stringify(body);
          if (body != null) {
            headers["content-type"] = "application/json";
            headers["content-length"] = Buffer.byteLength(data);
          }
          const res = new ServerResponse(req);
          let content = "";
          res.write = (chunk) => { content += String(chunk); return true; };
          res.end = (chunk) => {
            if (chunk) content += String(chunk);
            let parsed;
            try { parsed = JSON.parse(content); } catch { parsed = content; }
            const responseHeaders = res.getHeaders();
            if (typeof responseHeaders["set-cookie"] === "string") {
              responseHeaders["set-cookie"] = [responseHeaders["set-cookie"]];
            }
            resolve({ status: res.statusCode, headers: responseHeaders, body: parsed });
          };
          req.on("error", reject);
          req.push(data || null);
          if (data) req.push(null);
          server.emit("request", req, res);
        });
        if (result.status !== status) throw new Error(`Expected ${status}, received ${result.status}: ${JSON.stringify(result.body)}`);
        return result;
      },
    };
  };
  return Object.fromEntries(["post", "get", "options"].map((method) => [method, (url) => make(method.toUpperCase(), url)]));
}
