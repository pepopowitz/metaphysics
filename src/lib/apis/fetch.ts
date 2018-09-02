import { pick } from "lodash"
import config from "config"
import HTTPError from "lib/http_error"
import httpModule, {
  IncomingHttpHeaders,
  OutgoingHttpHeaders,
  RequestOptions,
} from "http"
import httpsModule from "https"
import { URL } from "url"

const USER_AGENT = "Metaphysics"

const agentOptions = {
  keepAlive: true,
}

const httpModules = {
  http: {
    agent: new httpModule.Agent(agentOptions),
    request: httpModule.request,
  },
  https: {
    agent: new httpsModule.Agent(agentOptions),
    request: httpsModule.request,
  },
}

interface Options {
  method?: "GET" | "POST" | "PUT"
  headers?: OutgoingHttpHeaders
  timeout?: number
  userAgent?: string
}

interface Result<T> {
  body: T | null
  headers: IncomingHttpHeaders
}

// TODO Use http or https
export function fetch<T>(url: string, options: Options = {}) {
  return new Promise<Result<T>>((resolve, reject) => {
    const uri = new URL(url)

    const requestOptions: RequestOptions = {
      ...pick(uri, ["host", "hostname", "port", "protocol"]),
      path: `${uri.pathname}?${uri.search}`,
      agent: httpModules["https"].agent,
      method: options.method || "GET",
      timeout: options.timeout || config.REQUEST_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
        ...options.headers,
        "User-Agent": options.userAgent
          ? `${options.userAgent}; ${USER_AGENT}`
          : USER_AGENT,
      },
    }

    let responseStatus: number = 0
    let responseBody: string | null = null
    let responseHeaders: IncomingHttpHeaders | null = null

    const req = httpsModule.request(requestOptions, res => {
      responseStatus = res.statusCode!
      responseHeaders = res.headers

      const buffers: Buffer[] = []
      let bufferLength = 0

      res.on("data", (chunk: Buffer) => {
        buffers.push(chunk)
        bufferLength += chunk.length
      })

      res.on("end", () => {
        if (bufferLength) {
          responseBody = Buffer.concat(buffers, bufferLength).toString("utf8")
        }

        // If there is a non-2xx status code, reject.
        if (responseStatus < 200 || responseStatus >= 300) {
          reject(
            new HTTPError(
              `[${responseStatus}] ${uri.href}`,
              responseStatus,
              responseBody
            )
          )
        } else {
          try {
            resolve({
              body: responseBody && JSON.parse(responseBody),
              headers: responseHeaders!,
            })
          } catch (err) {
            reject(err)
          }
        }
      })
    })

    req.setTimeout(requestOptions.timeout!, () => {
      req.abort()
    })

    req.on("error", reject)

    // We currently don’t write a body, we just pass URL params
    // req.write()

    req.end()
  })
}

export default fetch
