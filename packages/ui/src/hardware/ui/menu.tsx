'use client'

import { Icon } from "./icon.tsx"
import { chosenItem } from "../lib/chosen-item.ts"
import { Menu as SdkMenu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu"

function Menu({ label, items }: { label: string; items: string[] }) {
  return (
    <SdkMenu>
      <MenuTrigger data-kit="button" data-tone="secondary" data-shape="round" aria-label={label}>
        <Icon name="more" />
      </MenuTrigger>
      <MenuContent data-kit="popup" align="start" sideOffset={14}>
        {items.map((item) => (
          <MenuItem key={item} value={item} data-kit="option" {...chosenItem}>
            {item}
          </MenuItem>
        ))}
      </MenuContent>
    </SdkMenu>
  )
}

export { Menu }
