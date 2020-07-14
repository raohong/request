import { compile, pathToRegexp, Key } from 'path-to-regexp';
import { isPlainObject, parseUrl } from './util';

type ServiceItem<T extends AnyObject, R = any> = (params?: T, ...rest: T[]) => Promise<R>;
type AnyObject = Record<string, any>;
type Service<API, T, R> = {
  [K in keyof API]: API[K] extends object ? Service<API[K], T, R> : ServiceItem<T, R>;
};
type Action<T extends AnyObject, R> = (args: T, ...rest: T[]) => Promise<R>;

interface IOptions<T extends AnyObject> {
  getParams?: (method: string, config?: T) => AnyObject | null;
  setParams?: (method: string, params: AnyObject, config: T) => T;
  beforeRequest?: (task: any) => void;
}

const restfulDetect = /:[a-z]+/i;

const defaultOptions: IOptions<AnyObject> = {
  getParams: (method, params) => (params ? params[method === 'get' ? 'params' : 'data'] : null),
  setParams: (method, params, config) => {
    if (method === 'get') {
      config.params = {
        ...config.params,
        ...params,
      };
    } else {
      config.data = {
        ...config.data,
        ...params,
      };
    }

    return config;
  },
};

function genServiceItem<T extends AnyObject, R>(
  raw: string,
  request: Action<T, R>,
  { getParams, setParams, beforeRequest }: IOptions<T>
): ServiceItem<T, R> {
  const arr = raw.split(/\s+/);
  const method = arr.length === 1 ? 'get' : arr[0].toLowerCase();
  const inititalUrl = arr[1] || arr[0];
  const { origin, pathname } = parseUrl(inititalUrl);

  const cachedPathToRegexpCompileFunction:
    | ((params?: object, options?: { encode: (p: string) => string }) => string)
    | null = restfulDetect.test(pathname) ? compile(pathname) : null;
  const keys: Key[] = [];

  if (cachedPathToRegexpCompileFunction) {
    pathToRegexp(pathname, keys);
  }

  return (args, ...rest) => {
    let url: string = pathname;
    const params = getParams!(method, args);

    // restful 形式
    if (params && cachedPathToRegexpCompileFunction !== null && isPlainObject(params)) {
      const matched = cachedPathToRegexpCompileFunction(params, { encode: encodeURIComponent });

      if (matched.includes(':')) {
        throw Error(`unexpected url, raw: ${url} \n, params: ${JSON.stringify(params, null, 2)}`);
      }

      keys.forEach(({ name }) => {
        delete params[name];
      });

      url = matched;
    }

    url = `${origin || ''}${url}`;

    const requestConfig: AnyObject = {
      url,
      method,
      ...rest.reduce((map, current) => {
        return { ...map, ...current };
      }, {}),
    };

    const requestFormattedConfig = params ? setParams!(method, params, requestConfig as T) : requestConfig;

    // @ts-ignore
    const task: any = request(requestFormattedConfig);

    if (beforeRequest) {
      beforeRequest(task);
    }

    return task;
  };
}

function createService<T extends object, P extends AnyObject, R = any>(
  obj: T,
  request: Action<P, R>,
  // @ts-ignore
  options: IOptions<P> = defaultOptions
): Service<T, P, R> {
  const ret = {} as Service<T, P, R>;
  const op = {
    ...defaultOptions,
    ...options,
  } as IOptions<P>;

  if (isPlainObject(obj)) {
    Object.keys(obj).forEach(key => {
      const item = obj[key];
      ret[key] = isPlainObject(item)
        ? createService<T, P, R>(item as T, request, op)
        : genServiceItem<P, R>(item as string, request, op);
    });
  }

  return ret;
}

export default createService;
