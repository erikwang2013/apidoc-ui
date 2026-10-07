import { ref, Ref, onMounted, onUnmounted } from 'vue'
import { DeviceEnum } from '/@/enums/appEnum'
import { useAppStore } from '/@/store/modules/app'

interface Types {
  device: Ref<string>
}
export default (): Types => {
  const appStore = useAppStore()
  const mediaQuery = window.matchMedia('(max-width: 1024px)')
  const device = ref(setDevice(mediaQuery.matches))
  const onMediaChange = (e: MediaQueryListEvent) => {
    device.value = setDevice(e.matches)
  }
  onMounted(() => {
    mediaQuery.addEventListener('change', onMediaChange)
  })
  onUnmounted(() => {
    mediaQuery.removeEventListener('change', onMediaChange)
  })
  function setDevice(is: boolean) {
    const deviceCode = is === true ? DeviceEnum.MOBILE : DeviceEnum.DESKTOP
    appStore.setDevice(deviceCode)
    return deviceCode
  }

  return {
    device,
  }
}
