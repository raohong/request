/**
 * 是否是 object 对象
 * @param source
 */
export const isPlainObject = (source: any): source is object =>
  Object.prototype.toString.call(source) === '[object Object]';

export const parseUrl = (url: string): { origin?: string; pathname: string } => {
  const parser = /^https?:\/{2}?(\w+(?:-\w+)*\.?)+(?::\d+)?/;
  const matched = url.match(parser);

  return matched
    ? {
        origin: matched[0],
        pathname: url.slice(matched[0].length),
      }
    : {
        pathname: url,
      };
};
