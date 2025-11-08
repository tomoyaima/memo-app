import { Editor } from '@tinymce/tinymce-react'

import 'tinymce/tinymce'
import 'tinymce/icons/default'
import 'tinymce/themes/silver'
import 'tinymce/models/dom'

import 'tinymce/plugins/autoresize'
import 'tinymce/plugins/code'
import 'tinymce/plugins/image'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/table'

import 'tinymce/skins/ui/oxide/skin.min.css'
import 'tinymce/skins/content/default/content.min.css'

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function NoteEditor({ value, onChange, placeholder }: Props) {
  return (
    <Editor
      apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
      value={value}
      init={{
        menubar: false,
        statusbar: false,
        branding: false,
        min_height: 360,
        placeholder,
        plugins: 'link lists table code image autoresize',
        toolbar:
          'undo redo | styles | bold italic underline forecolor backcolor | alignleft aligncenter alignright | bullist numlist | link image | table | code',
        content_style:
          'body { font-family: "Inter", "Noto Sans JP", sans-serif; line-height: 1.6; font-size: 16px; background:#0e1630; color:#f4f7fb;}',
      }}
      onEditorChange={onChange}
    />
  )
}

export default NoteEditor
