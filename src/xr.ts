/**
 * xr (c) James Cleveland 2015
 * URL: https://github.com/radiosilence/xr
 * License: BSD
 */

import { encode } from 'querystring'

import { Methods, METHODS, EVENTS } from './constants'

export interface Config {
    url?: string
    method: keyof Methods
    data?: object | string
    headers: { [key: string]: string }
    dump: (data: object) => string
    load: (string: string) => object
    xmlHttpRequest: () => XMLHttpRequest
    promise: (fn: () => Promise<any>) => Promise<any>
    abort?: any
    params?: object | null
    withCredentials: boolean
    raw?: boolean
    events?: { [key: string]: () => void }
}

const defaults: Config = {
  method: METHODS.GET,
  data: undefined,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  dump: JSON.stringify,
  load: JSON.parse,
  xmlHttpRequest: (): XMLHttpRequest => new XMLHttpRequest(),
  promise: (fn: () => Promise<any>) => new Promise(fn),
  withCredentials: false,
}

export interface Response {
    status: number
    response: object
    data?: string | object
    xhr: XMLHttpRequest
}

const res = (xhr: XMLHttpRequest, data?: string | object): Response => ({
    status: xhr.status,
    response: xhr.response,
    data,
    xhr,
})

let config: Config = { ...defaults }

const configure = (opts: Partial<Config>): void => {
    config = { ...config, ...opts }
}

const promise = (args: Partial<Config>, fn: any) =>
  ((args && args.promise)
    ? args.promise
    : (config.promise || defaults.promise)
  )(fn)

const xr = (args: Partial<Config>): Promise<any>  =>
    promise(args, (resolve: any, reject: any) => {
        const opts: Config = { ...defaults, ...config, ...args }
        const xhr = opts.xmlHttpRequest()

        if (opts.abort) {
            args.abort(() => {
                reject(res(xhr))
                xhr.abort()
            })
        }

        if (opts.url === undefined) throw new Error('No URL defined')

        xhr.open(
            opts.method,
            opts.params
                ? `${opts.url.split('?')[0]}?${encode(opts.params)}`
                : opts.url,
            true,
            )

        // setting after open for compatibility with IE versions <=10
        xhr.withCredentials = opts.withCredentials

        xhr.addEventListener(EVENTS.LOAD, () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                let data
                if (xhr.responseText) {
                    data = opts.raw === true
                        ? xhr.responseText
                        : opts.load(xhr.responseText)
                }
                resolve(res(xhr, data))
            } else {
                reject(res(xhr))
            }
        })

        xhr.addEventListener(EVENTS.ABORT, () => reject(res(xhr)))
        xhr.addEventListener(EVENTS.ERROR, () => reject(res(xhr)))
        xhr.addEventListener(EVENTS.TIMEOUT, () => reject(res(xhr)))

        for (const k in opts.headers) {
            if (!{}.hasOwnProperty.call(opts.headers, k)) continue
            xhr.setRequestHeader(k, opts.headers[k])
        }

        if (opts.events) {
            for (const k in opts.events) {
                if (!{}.hasOwnProperty.call(opts.events, k)) continue
                xhr.addEventListener(k, opts.events[k].bind(null, xhr), false)
            }
        }

        const data = (typeof opts.data === 'object' && !opts.raw)
            ? opts.dump(opts.data)
            : opts.data

        if (data !== undefined) xhr.send(data)
            else xhr.send()
    })

const api = {
    configure,
    EVENTS,
    METHODS,
    get: (url: string, params?: object, args?: Partial<Config>) =>
        xr({ url, method: METHODS.GET, params, ...args }),
    put: (url: string, data: any, args: Partial<Config>) =>
        xr({ url, method: METHODS.PUT, data, ...args }),
    post: (url: string, data: any, args: Partial<Config>) =>
        xr({ url, method: METHODS.POST, data, ...args }),
    patch: (url: string, data: any, args: Partial<Config>) =>
        xr({ url, method: METHODS.PATCH, data, ...args}),
    del: (url: string, args: Partial<Config>) =>
        xr({ url, method: METHODS.DELETE, ...args}),
    options: (url: string, args: Partial<Config>) =>
        xr({ url, method: METHODS.OPTIONS, ...args})
}

export default api
