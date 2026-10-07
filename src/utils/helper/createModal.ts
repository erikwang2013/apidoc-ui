import { createApp, Component } from 'vue'
import { ObjectType } from '/#/index'
import piniaStore from '/@/store'

interface ModalOptions {
  /** 是否包装 onSuccess：Markdown 弹窗无 success 事件，传 false 保持 props 原样透传 */
  wrapOnSuccess?: boolean
  /** success 回调触发后是否一并卸载：Generator / CodeTemplate / ApiShare 需要 */
  unmountOnSuccess?: boolean
}

/**
 * 命令式弹窗工厂：createApp + 手动挂载容器，onCancel 触发后卸载并移除容器。
 * 返回函数的入参为 props，返回值与旧实现一致：createApp 得到的应用实例。
 */
export function createModal(
  component: Component,
  { wrapOnSuccess = true, unmountOnSuccess = false }: ModalOptions = {},
) {
  return function modal(props: ObjectType<any>): any {
    const appProps: ObjectType<any> = { ...props }
    if (wrapOnSuccess) {
      appProps.onSuccess = (res: any) => {
        props.onSuccess && props.onSuccess(res)
        unmountOnSuccess && unmount()
      }
    }
    appProps.onCancel = () => {
      props.onCancel && props.onCancel()
      unmount()
    }
    // 实例化组件，createApp第二个参数是props
    const instance = createApp(component, appProps).use(piniaStore)
    // 卸载组件
    const unmount = () => {
      instance.unmount()
      document.body.removeChild(parentNode)
    }
    // 创建一个挂载容器
    const parentNode = document.createElement('div')
    document.body.appendChild(parentNode)
    // 挂载组件
    instance.mount(parentNode)
    return instance
  }
}
