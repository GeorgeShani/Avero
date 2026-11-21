'use client'

import * as React from 'react'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Textarea as SdkTextarea } from '@ui-sdk/react/textarea'

function Textarea({
  label,
  name,
  ...props
}: { label: string; name?: string } & Omit<React.ComponentProps<typeof SdkTextarea>, 'name'>) {
  return (
    <Field data-kit="field" name={name}>
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <SdkTextarea data-kit="input" data-multiline="" {...props} />
    </Field>
  )
}

export { Textarea }
