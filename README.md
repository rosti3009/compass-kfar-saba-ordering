# מערכת הזמנות - קומפס מעדני בשר כפר סבא

החבילה הזו מחברת יחד:
- אתר הזמנות ב-Render
- Google Apps Script
- Google Sheet עם סל המוצרים של כפר סבא
- תיקיית Drive לשמירת קבצי PDF
- מייל התראות קיים: aviv@blucher.co.il

## קבצים בחבילה

1. `index.html` - אתר הזמנות מלא, כולל לוגו, סל קניות, תמונות מוצרים, טופס הזמנה וחיבור ל-Google Apps Script.
2. `Code.gs` - קוד Apps Script מלא לניהול הזמנות, PDF, מיילים ומשיכת מוצרים מה-Google Sheet.
3. `appsscript.json` - הרשאות ופריסת Web App.
4. `assets/compass-logo.jpeg` - לוגו קומפס.
5. `products-kfar-saba.csv` - סל המוצרים שהעלית, כולל קישורי תמונות.
6. `compass_kfar_saba_google_sheet_ready.xlsx` - קובץ אקסל מוכן להעלאה ל-Google Sheets.

## מבנה החיבור

אתר ב-Render  
↓  
Google Apps Script Web App URL  
↓  
Google Sheet מוצרים/הזמנות + תיקיית PDF ב-Google Drive + מייל התראות

## שלב 1 - הכנת Google Drive

1. צור תיקייה בדרייב בשם:
   `Compass Meat Kfar Saba Orders`
2. בתוך התיקייה צור תיקיית משנה בשם:
   `PDF Orders`
3. העלה את הקובץ `compass_kfar_saba_google_sheet_ready.xlsx` לדרייב.
4. פתח אותו עם Google Sheets ושמור אותו כ-Google Sheet.

## שלב 2 - לקחת מזהים

מתוך הקישור של Google Sheet:
`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

מתוך הקישור של תיקיית PDF:
`https://drive.google.com/drive/folders/FOLDER_ID`

## שלב 3 - Apps Script

ב-`Code.gs` להחליף:

```js
const FOLDER_ID = 'PASTE_KFAR_SABA_PDF_FOLDER_ID_HERE';
const SPREADSHEET_ID = 'PASTE_KFAR_SABA_SPREADSHEET_ID_HERE';
```

להריץ פעם אחת:
- `authorizeMail`
- `testProducts`
- `testWebsiteOrder`

לאחר מכן:
Deploy > New deployment > Web app

הגדרות:
- Execute as: Me
- Who has access: Anyone

להעתיק את כתובת ה-`/exec`.

## שלב 4 - Render

ב-`index.html` להחליף:

```js
const GOOGLE_SCRIPT_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
```

בכתובת ה-Apps Script שקיבלת.

## עדכון מחירים בהמשך

המחירים נשארים בגוגל שיטס בלבד.  
כל שינוי בעמודה `price` בגיליון `גיליון1` יתעדכן באתר אחרי רענון הדף.

## עמודות חובה בגיליון מוצרים

`id | category | name | price | unit | description | image | active`

כדי להסתיר מוצר מהאתר: לשנות `active` ל-`FALSE`.
