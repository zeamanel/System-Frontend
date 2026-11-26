import type { PickerSession } from './client'

/**
 * The Google file picker, for choosing a spreadsheet. With the drive.file
 * permission the app sees only the files a person picks here, so this is
 * how a spreadsheet becomes readable. Google's script is loaded the first
 * time it is needed, never before.
 */

const PICKER_SCRIPT = 'https://apis.google.com/js/api.js'

interface PickerDoc {
  id: string
  name?: string
}
interface PickerResponse {
  action: string
  docs?: PickerDoc[]
}
interface PickerBuilder {
  addView(view: unknown): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setLocale(locale: string): PickerBuilder
  setTitle(title: string): PickerBuilder
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}
interface GooglePickerApi {
  PickerBuilder: new () => PickerBuilder
  ViewId: { SPREADSHEETS: unknown }
  Action: { PICKED: string; CANCEL: string }
}
interface GapiWindow {
  gapi?: { load(name: string, callback: () => void): void }
  google?: { picker?: GooglePickerApi }
}

let loading: Promise<GooglePickerApi> | null = null

function loadPicker(): Promise<GooglePickerApi> {
  const scope = window as unknown as GapiWindow
  if (scope.google?.picker) return Promise.resolve(scope.google.picker)
  loading ??= new Promise<GooglePickerApi>((resolve, reject) => {
    const ready = () =>
      scope.gapi!.load('picker', () => (scope.google?.picker ? resolve(scope.google.picker) : reject(new Error('No picker'))))
    if (scope.gapi) {
      ready()
      return
    }
    const script = document.createElement('script')
    script.src = PICKER_SCRIPT
    script.async = true
    script.onload = ready
    script.onerror = () => reject(new Error('The Google picker could not be loaded'))
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    loading = null
    throw error
  })
  return loading
}

/** Shows the picker; the spreadsheet chosen, or null when the person closed it. */
export async function pickSpreadsheet(session: PickerSession, options: { locale: string; title: string }): Promise<PickerDoc | null> {
  const picker = await loadPicker()
  return new Promise<PickerDoc | null>((resolve) => {
    new picker.PickerBuilder()
      .addView(picker.ViewId.SPREADSHEETS)
      .setOAuthToken(session.accessToken)
      .setDeveloperKey(session.apiKey)
      // With drive.file, the app id lets the picked file be read by the app.
      .setAppId(session.appId)
      .setLocale(options.locale)
      .setTitle(options.title)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED && response.docs?.[0]?.id) resolve(response.docs[0])
        else if (response.action === picker.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}
