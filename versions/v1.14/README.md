# HaikanCAD v1.14

## Auto Language Detection (EN/JP) + No Emojis

### Features
- Auto-detects device/browser language on first load
- Japanese devices → Japanese UI
- English/other devices → English UI
- Language toggle in settings dropdown
- Preference saved to localStorage
- All emojis replaced with clean SVG icons

### Translations
| English | Japanese |
|---------|----------|
| Grid | グリッド |
| Center View | 中央に戻す |
| Magnifier | 拡大鏡 |
| Auto-Locate | 自動配置 |
| Follow | 追従 |
| Center | 中央 |
| Language | 言語 |

### SVG Icons
- SunIcon (light mode toggle)
- MoonIcon (dark mode toggle)
- SettingsIcon (settings dropdown)
- GridIcon (grid toggle)
- CrosshairIcon (center view)
- MagnifierIcon (magnifier toggle)
- RotateIcon (mode cycle)
- GlobeIcon (language toggle)
- CheckIcon (active indicator)

### Files Changed
- `src/ui/Icons.jsx` - New SVG icon components
- `src/ui/TopBar.jsx` - Added translations, language detection, and SVG icons
- `README.md` - Removed all emojis
