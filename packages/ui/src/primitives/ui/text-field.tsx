'use client'

import * as React from 'react'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import { Input } from '@ui-sdk/react/input'

function TextField({
  label,
  name,
  ...props
}: { label: string; name?: string } & Omit<React.ComponentProps<typeof Input>, 'name'>) {
  return (
    <Field data-kit="field" name={name}>
      <FieldLabel data-kit="label">{label}</FieldLabel>
      <Input data-kit="input" spellCheck={false} {...props} />
    </Field>
  )
}

export { TextField }
