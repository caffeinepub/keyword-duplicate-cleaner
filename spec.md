# Keyword Duplicate Cleaner

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- Table with two columns: "Ключевой запрос" (keyword) and "Частота" (frequency)
- Manual row entry: add new rows via input fields in the table
- File import: upload Excel (.xlsx) or CSV file to populate the table
- "Анализ дублей" button: scans the keyword column for exact text matches, highlights all duplicate rows
- Duplicate highlighting: rows with duplicate keywords are visually highlighted; the row with the highest frequency is marked as "winner", the rest as duplicates to be removed
- "Очистить дубли" button: removes all duplicate rows, keeping only the row with the highest frequency per keyword group
- Export button: download the current (cleaned) table as an .xlsx file
- Row deletion: ability to manually delete individual rows

### Modify
N/A

### Remove
N/A

## Implementation Plan
1. Backend (Motoko): store keyword-frequency pairs, support CRUD operations (add, delete, clear), and duplicate detection logic
2. Frontend:
   - Table component displaying keyword and frequency columns
   - Manual row addition form (inline or below table)
   - File import handler (parse .xlsx and .csv client-side, populate table)
   - Analyze button triggers duplicate detection, highlights duplicate rows
   - Clean duplicates button removes lower-frequency duplicates, keeps highest frequency per keyword
   - Export to .xlsx using a client-side library (e.g. SheetJS/xlsx)
   - Row-level delete buttons
