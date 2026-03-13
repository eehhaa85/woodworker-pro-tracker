# WorkshopTracker - Project Memory
Updated: today

## Design System
- Dark industrial minimalism (graphite/steel)
- Colors: background #121519, primary amber hsl(36,95%,54%), accent teal hsl(160,55%,42%)
- Fonts: JetBrains Mono (display/numbers), Inter (body)
- Mobile-first, large touch targets

## Architecture
- Auth: email/password via Supabase
- Tables: products, work_entries (with hours_overtime col), daily_time_logs (with day_type col), user_settings
- PWA enabled via vite-plugin-pwa
- Rates: standard 400₽/h, overtime 600₽/h, sick 200₽/h, full sheet 660₽, half 330₽
- Project grouping: case-insensitive (toLowerCase key), serial furniture = "TR"
- Hours: two fields (standard + overtime), sick/vacation = day-level on daily_time_logs
- Nesting: single field with 0.5 step (derives full_sheets + half_sheets)

## Pages
- /auth - login/signup
- / - daily entry form with autocomplete, two hour fields, day_type selector
- /dashboard - stats + history with edit button (navigates to / with state)
- /catalog - product catalog management
- /report - monthly timesheet with grouped descriptions, compact PDF, new month button, delete workday
- /settings - rates, background, backup/restore (JSON export/import)
