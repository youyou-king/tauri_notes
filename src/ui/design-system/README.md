# UI Design System

The shell owns presentation primitives; feature plugins consume them through
`ui/sdk`.

## Primitives

| Primitive | Responsibility |
| --- | --- |
| `Button` / `IconButton` | click targets, variants, disabled and focus state |
| `Field` / `TextInput` / `Select` | labelled form controls |
| `Icon` / `PanelIcon` | shared SVG iconography |
| `ModalSurface` | portal, backdrop, focus trap, Escape and modal stack |
| `Dialog` | titled modal with header, body and footer |
| `Popover` | anchored/floating surface positioning and dismissal |
| `PanelHeader` / `PanelShell` | dock panel frame and header slots |
| `SurfaceHeader` | non-dialog surface title, subtitle, actions and close |
| `StateView` | empty, loading and error states |

## Rules

- Dialog-like surfaces use `ModalSurface`; `role="dialog"` is declared only
  there.
- Menus and floating surfaces use `Popover`; dismissal is owned by
  `useDismissableLayer`.
- Business `<select>` controls use `Select`; raw native selects belong only in
  the design system implementation.
- Browser-native `window.prompt`, `window.alert` and `window.confirm` are
  forbidden.
- Tree rows, menu items, editor toolbars and window chrome are semantic
  widgets. They may use native elements for their semantics, but must consume
  design tokens and must not reimplement modal, popover or form primitives.
