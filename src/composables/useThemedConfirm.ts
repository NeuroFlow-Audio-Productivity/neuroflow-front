import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'

type ConfirmDangerOptions = {
  message: string
  title?: string
  acceptLabel?: string
  rejectLabel?: string
}

export const useThemedConfirm = () => {
  const confirm = useConfirm()
  const { t } = useI18n()

  const confirmDanger = (options: ConfirmDangerOptions) =>
    new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (value: boolean) => {
        if (settled) return

        settled = true
        resolve(value)
      }

      confirm.require({
        group: 'theme',
        header: options.title ?? t('dialog.deleteTitle'),
        message: options.message,
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: options.acceptLabel ?? t('dialog.delete'),
        rejectLabel: options.rejectLabel ?? t('dialog.cancel'),
        defaultFocus: 'reject',
        accept: () => finish(true),
        reject: () => finish(false),
        onHide: () => finish(false),
      })
    })

  return {
    confirmDanger,
  }
}
