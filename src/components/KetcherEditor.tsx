// Tải riêng (React.lazy): Ketcher + Indigo WASM nặng ~20 MB, chỉ tải khi mở hộp thoại vẽ.
import type { Ketcher, StructServiceProvider } from 'ketcher-core'
import { Editor } from 'ketcher-react'
import 'ketcher-react/dist/index.css'
import { StandaloneStructServiceProvider } from 'ketcher-standalone'

const provider = new StandaloneStructServiceProvider() as unknown as StructServiceProvider

export default function KetcherEditor({ onInit, onError }: { onInit: (k: Ketcher) => void; onError: (message: string) => void }) {
  return (
    <Editor
      staticResourcesUrl={import.meta.env.BASE_URL.replace(/\/$/, '')}
      structServiceProvider={provider}
      errorHandler={onError}
      onInit={onInit}
      disableMacromoleculesEditor
    />
  )
}
