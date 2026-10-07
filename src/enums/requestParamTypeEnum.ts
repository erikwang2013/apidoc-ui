//参数类型
export enum ParamTypeEnum {
  HEADER = 'header',
  QUERY = 'query',
  BODY = 'body',
  ROUTEPARAM = 'routeParam',
}

// export enum RequestMethodEnum {
//   GET = 'GET',
//   POST = 'POST',
//   BODY = 'data',
// }

export const paramTypeKeys = (() => {
  return [ParamTypeEnum.HEADER, ParamTypeEnum.QUERY, ParamTypeEnum.BODY]
})()
