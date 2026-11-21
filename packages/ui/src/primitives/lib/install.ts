import { installBlockCaret } from "./block-caret.ts"
import { installHaptics } from "./haptics.ts"
import { installInputModality } from "./input-modality.ts"
import { installSafariTabbing } from "./safari-tabbing.ts"
import { installSound } from "./sound.ts"

// The page-wide behaviors the skin relies on: the block caret, haptics and
// sounds, keyboard-only focus rings and Safari's Tab order. Each listens at
// the document, so they're installed once, however many roots there are.
let installed = false

function installHardware() {
  if (installed || typeof document === "undefined") return
  installed = true
  installBlockCaret()
  installHaptics()
  installSound()
  installSafariTabbing()
  installInputModality()
}

export { installHardware }
