'use client'

import { haptic } from '../lib/haptics.ts'
import { Field, FieldLabel } from '@ui-sdk/react/field'
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from '@ui-sdk/react/number-input'
import { Icon } from './icon.tsx'

function Stepper({
  label,
  defaultValue,
  min = 0,
  max = 999,
  step,
  onValueChange,
}: {
  label: string
  defaultValue: number
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number | null) => void
}) {
  return (
    <NumberInput
      defaultValue={defaultValue}
      min={min}
      max={max}
      step={step}
      onValueChange={(value) => {
        haptic('selection')
        onValueChange?.(typeof value === 'number' ? value : null)
      }}
    >
      <Field data-kit="field">
        <FieldLabel data-kit="label">{label}</FieldLabel>
        <NumberInputGroup data-kit="stepper">
          <NumberInputDecrement data-kit="button" data-tone="secondary" aria-label="Decrease">
            <Icon name="minus" />
          </NumberInputDecrement>
          <NumberInputControl data-kit="stepper-input" aria-label={label} />
          <NumberInputIncrement data-kit="button" data-tone="secondary" aria-label="Increase">
            <Icon name="plus" />
          </NumberInputIncrement>
        </NumberInputGroup>
      </Field>
    </NumberInput>
  )
}

export { Stepper }
