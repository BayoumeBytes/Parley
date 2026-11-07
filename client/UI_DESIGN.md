# Parley interface

## Direction

- **Product:** Private direct and group conversations, with people found by username, email, or phone.
- **Character:** Warm, conversational, composed.
- **World:** Quiet paper-like surfaces and dark ink, with sage as the accent.
- **Moments:** Sender avatars carry the accent; messages, navigation and forms stay quiet.
- **Signature:** The asymmetric corner remains in the brand mark and auth illustration.

This is a polish of the existing identity, not a redesign of the product.
Keep DM Sans, Manrope, the split authentication screen, and the existing bubble
illustrations. Do not add decorative animation or marketing imagery to the chat.
The working conversation uses plain text rather than message bubbles. Consecutive
messages from the same sender on the same local day share one avatar, username,
and timestamp (the first message's time). A sender change or date boundary starts
a new group. Outgoing groups remain aligned right; incoming groups align left.

## Interface rules

- Shared colors and interaction timing live in `src/styles.css`. Use the three
  text roles rather than adding one-off caption colors.
- Both themes use the same semantic tokens. Dark mode uses forest-tinted neutral
  surfaces and a lighter sage accent; accent fills must use `--on-accent` for
  their text rather than hard-coded white. Native controls inherit `color-scheme`.
  Keep theme controls available on sign-in, phone setup, and the chat rail.
- Account identity colors are the deliberate exception to the single chrome
  accent: use the saved account color on avatars, and its contrast-adjusted hue
  for usernames. Never hash the display name. The shared function in
  `shared/account-color.mjs` is the only account-ID color algorithm.
- Use a 4px spacing rhythm, with 2px adjustments only inside small controls.
- Body text is 14px; labels and metadata are at least 12px. Inputs are 16px on
  mobile to avoid browser auto-zoom.
- Weights are 400 and 500, with 600 reserved for the wordmark.
- The navigation rail is 64px and the conversation list is 280px on desktop.
  Conversation rows use consistent padding and a 72px minimum height to fit a
  name and preview without compressing the text.
- Use the local Lucide subset through `app-icon`: 18px, 1.5px stroke, inherited
  color. Icon-only buttons must retain an accessible name.
- Buttons and input radii are 8px. A 16px composer with 8px padding contains
  an 8px-radius send button; a 12px segmented control with 4px padding contains
  8px buttons.
- The composer owns the message field's border and focus state. Its textarea has
  no border or inner focus outline; the paper-plane submit button sits inside
  the shared field and keeps its own keyboard focus indicator.
- Primary phone fields share one outer border around a left-hand native country
  selector (flag and dialing code) and a local-number input. Keep country names
  in the select options for keyboard/typeahead and assistive technology; flags
  are supplementary, not the only country identifier.
- Dialogs have a viewport-bounded height with the backdrop padding subtracted.
  Only the dialog scrolls. Test with developer tools open, not just full-height
  desktop windows.
- Preserve keyboard focus rings, dialog focus management, reduced-motion support,
  and pressed states for conversation-type controls.
- Copy names the action or context: “Sign in to Parley”, “Conversation history”,
  “Write a message”. Short labels have no trailing periods.

## Validation

```sh
npm run build
npm test -- --watch=false
```

Also check sign-in, registration, conversation list, active messages, details,
and direct/group dialogs at desktop, 390px mobile width, and short viewport
heights. Check long names, multiline messages, empty states, and keyboard focus.

## Credits

Polish process informed by **unslop**, created by Damir Sokolovsky
([@heydamir](https://x.com/heydamir)), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
This adaptation retains Parley's existing identity and functionality.

The local Lucide icon subset includes its license in `public/icons.svg`.
