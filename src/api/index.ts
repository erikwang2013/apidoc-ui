import { URL as apidocUrls } from './apidocApi/index'
import { URL as globalUrls } from './globalApi/index'
import { URL as debugUrls } from './debugApi/index'

export const getApidocUrls = () => {
  const paths: string[] = []
  for (const k in apidocUrls) {
    paths.push(apidocUrls[k])
  }
  for (const k in globalUrls) {
    paths.push(globalUrls[k])
  }
  for (const k in debugUrls) {
    paths.push(debugUrls[k])
  }
  return paths
}
