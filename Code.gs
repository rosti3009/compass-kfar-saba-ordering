/******************** הגדרות קומפס מעדני בשר - כפר סבא ********************/
const BUSINESS_NAME = 'קומפס מעדני בשר';
const BRANCH_NAME = 'כפר סבא';
const BUSINESS_ADDRESS = 'רח׳ סוקולוב 3, כפר סבא';
const BUSINESS_PHONE = '050-4340274';

const ORDERS_SHEET_NAME = 'הזמנות אתר';
const PRODUCTS_SHEET_NAME = 'גיליון1';

// חובה להחליף לאחר יצירת Drive Folder ו-Google Sheet חדשים לכפר סבא
const FOLDER_ID = 'PASTE_KFAR_SABA_PDF_FOLDER_ID_HERE';
const SPREADSHEET_ID = 'PASTE_KFAR_SABA_SPREADSHEET_ID_HERE';

const WRITE_BACK_LINK = true;
const LINK_HEADER_NAME = 'קובץ PDF';

// לפי הבקשה שלך - נשאר האימייל הקיים
const NOTIFICATION_EMAIL = 'aviv@blucher.co.il';
const NOTIFICATION_SUBJECT = 'הזמנה חדשה התקבלה באתר - קומפס מעדני בשר כפר סבא';
/************************************************/

function doPost(e) {
  try {
    const data = parseRequest_(e);
    const customer = data.customer || {};
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(ORDERS_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(ORDERS_SHEET_NAME);
      sheet.appendRow(['תאריך','מספר הזמנה','שם לקוח','טלפון','אימייל','יישוב','כתובת','סוג הזמנה','הערות','אישור שיווקי','מוצרים','סה"כ',LINK_HEADER_NAME]);
    }

    const orderNumber = data.orderNumber || Utilities.getUuid().slice(0, 8).toUpperCase();
    const customerName = data.customerName || data.name || customer.name || 'לקוח';
    const phone = data.phone || customer.phone || '';
    const email = data.email || customer.email || '';
    const city = data.city || customer.city || '';
    const address = data.address || customer.address || '';
    const orderType = data.orderType || customer.orderType || '';
    const notes = data.notes || customer.notes || '';
    const marketingConsent = parseMarketingConsent_(data.marketingConsent ?? customer.marketingConsent);
    const items = normalizeItems_(data.items || data.products || []);
    const total = data.total || calculateTotal_(items);

    if (!items.length) throw new Error('לא התקבלו מוצרים בהזמנה');

    const now = new Date();
    const rowData = {
      'תאריך': now,
      'מספר הזמנה': orderNumber,
      'שם לקוח': customerName,
      'טלפון': phone,
      'אימייל': email,
      'יישוב': city,
      'כתובת': address,
      'סוג הזמנה': orderType,
      'הערות': notes,
      'אישור שיווקי': marketingConsent ? 'כן' : 'לא',
      'מוצרים': JSON.stringify(items, null, 2),
      'סה"כ': total
    };
    const row = appendOrderRowByHeaders_(sheet, rowData);

    const pdfFile = createOrderPdf_({orderNumber, customerName, phone, email, city, address, orderType, notes, marketingConsent, items, total, date: now});
    if (WRITE_BACK_LINK) writeBackLink_(sheet, row, pdfFile.getUrl(), LINK_HEADER_NAME);
    sendNewOrderNotificationEmail_({orderNumber, customerName, phone, email, city, address, orderType, notes, marketingConsent, items, total, date: now}, pdfFile);

    return jsonResponse_({success:true, orderNumber, pdfUrl:pdfFile.getUrl(), emailed:true});
  } catch (err) {
    return jsonResponse_({success:false, error:err.message});
  }
}

function doGet(e) {
  try {
    const products = getProductsFromSheet_();
    return jsonResponse_({success:true, products});
  } catch (err) {
    return jsonResponse_({success:false, error:err.message});
  }
}

function getProductsFromSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(PRODUCTS_SHEET_NAME);
  if (!sheet) throw new Error('לא נמצא גיליון בשם ' + PRODUCTS_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h == null ? '' : h).trim());
  const keyMap = {
    id: headers.indexOf('id'),
    name: headers.indexOf('name'),
    active: headers.indexOf('active')
  };

  return data.slice(1).filter(row => {
    const values = row.map(v => String(v == null ? '' : v).trim());
    const hasAnyValue = values.some(v => v !== '');
    if (!hasAnyValue) return false; // ignore only completely empty rows

    const idValue = keyMap.id > -1 ? values[keyMap.id] : '';
    const nameValue = keyMap.name > -1 ? values[keyMap.name] : '';
    if (idValue === '' && nameValue === '') return false; // not a valid product row

    if (keyMap.active === -1) return true;
    const activeValue = String(values[keyMap.active] || '').toUpperCase();
    return activeValue === '' || activeValue === 'TRUE' || activeValue === 'SOLDOUT';
  }).map(row => {
    const product = {};
    headers.forEach((header, i) => {
      product[header] = String(row[i] == null ? '' : row[i]).trim();
    });
    return product;
  });
}

function parseRequest_(e) {
  if (!e) throw new Error('לא התקבל מידע מהאתר');
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); }
    catch (err) { throw new Error('JSON לא תקין מהאתר: ' + err.message); }
  }
  const params = e.parameter || {};
  return {orderNumber:params.orderNumber, customerName:params.customerName || params.name, phone:params.phone, email:params.email, city:params.city, address:params.address, orderType:params.orderType, notes:params.notes, total:params.total, items:params.items ? JSON.parse(params.items) : []};
}

function normalizeItems_(items) {
  if (typeof items === 'string') items = JSON.parse(items);
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    id: item.id || '',
    name: item.name || item.productName || item.title || '',
    qty: item.qty || item.quantity || '',
    unit: item.unit || 'ק״ג',
    price: item.price || '',
    total: item.total || item.lineTotal || ''
  })).filter(item => String(item.name).trim() !== '');
}

function calculateTotal_(items) {
  return items.reduce((sum, item) => {
    const lineTotal = Number(item.total) || 0;
    if (lineTotal) return sum + lineTotal;
    return sum + ((Number(item.qty) || 0) * (Number(item.price) || 0));
  }, 0);
}
function parseMarketingConsent_(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'כן';
}

function appendOrderRowByHeaders_(sheet, rowData) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const rowValues = headers.map(header => Object.prototype.hasOwnProperty.call(rowData, header) ? rowData[header] : '');
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
}

function createOrderPdf_({orderNumber, customerName, phone, email, city, address, orderType, notes, marketingConsent, items, total, date}) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const safeName = String(customerName).replace(/[\\/:*?"<>|]/g, '-');
  const stamp = Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
  const docName = `קומפס_כפר_סבא_הזמנה_${orderNumber}_${safeName}_${stamp}`;
  const doc = DocumentApp.create(docName);
  const docFile = DriveApp.getFileById(doc.getId());
  folder.addFile(docFile);
  DriveApp.getRootFolder().removeFile(docFile);

  const body = doc.getBody();
  body.clear();
  body.appendParagraph(`${BUSINESS_NAME} - ${BRANCH_NAME}`).setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph(BUSINESS_ADDRESS + ' | ' + BUSINESS_PHONE).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('תעודת הזמנה / ליקוט').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph(`מספר הזמנה: ${orderNumber}`).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph(`תאריך: ${Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')}`).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('');

  body.appendParagraph('פרטי לקוח').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  const customerTable = body.appendTable([
    ['שדה', 'פרטים'], ['שם לקוח', customerName || ''], ['טלפון', phone || ''], ['אימייל', email || ''], ['יישוב', city || ''], ['כתובת', address || ''], ['סוג הזמנה', orderType || ''], ['הערות', notes || ''], ['אישור שיווקי', marketingConsent ? 'כן' : 'לא']
  ]);
  customerTable.getRow(0).editAsText().setBold(true);

  body.appendParagraph('');
  body.appendParagraph('מוצרים להזמנה').setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  const itemsTable = body.appendTable();
  const headerRow = itemsTable.appendTableRow();
  ['מוצר','כמות','יחידה','מחיר','סה"כ'].forEach(h => headerRow.appendTableCell(h));
  items.forEach(item => {
    const row = itemsTable.appendTableRow();
    row.appendTableCell(String(item.name || ''));
    row.appendTableCell(String(item.qty || ''));
    row.appendTableCell(String(item.unit || ''));
    row.appendTableCell(String(item.price || ''));
    row.appendTableCell(String(item.total || ''));
  });
  itemsTable.getRow(0).editAsText().setBold(true);
  body.appendParagraph('');
  body.appendParagraph(`סה"כ משוער: ₪${total || 0}`).setBold(true).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph('');
  body.appendParagraph('הערה: חיוב סופי יתבצע לפי שקילה בפועל וזמינות מלאי.').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  doc.saveAndClose();
  const pdfBlob = docFile.getBlob().getAs(MimeType.PDF);
  return folder.createFile(pdfBlob).setName(docName + '.pdf');
}

function sendNewOrderNotificationEmail_(order, pdfFile) {
  const itemsText = order.items.map((item, index) => `${index + 1}. ${item.name} × ${item.qty} ${item.unit || ''} — מחיר: ₪${item.price || ''} — סה"כ: ₪${item.total || ''}`).join('\n');
  const body = [
    'התקבלה הזמנה חדשה באתר קומפס מעדני בשר כפר סבא.', '',
    `מספר הזמנה: ${order.orderNumber}`, `שם לקוח: ${order.customerName}`, `טלפון: ${order.phone}`, `אימייל: ${order.email || '-'}`,
    `יישוב: ${order.city || '-'}`, `כתובת: ${order.address || '-'}`, `סוג הזמנה: ${order.orderType || '-'}`, `הערות: ${order.notes || '-'}`, `אישור שיווקי: ${order.marketingConsent ? 'כן' : 'לא'}`,
    '', 'מוצרים:', itemsText || '-', '', `סה"כ משוער: ₪${order.total || 0}`,
    `תאריך: ${Utilities.formatDate(order.date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')}`, '', `קישור לקובץ PDF: ${pdfFile.getUrl()}`
  ].join('\n');
  MailApp.sendEmail({to: NOTIFICATION_EMAIL, subject: NOTIFICATION_SUBJECT, body, attachments: [pdfFile.getBlob()]});
}

function writeBackLink_(sheet, row, url, headerName) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  let colIndex = headers.findIndex(h => h === headerName);
  if (colIndex === -1) { sheet.getRange(1, lastCol + 1).setValue(headerName); colIndex = lastCol; }
  sheet.getRange(row, colIndex + 1).setValue(url);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setupCompassKfarSabaSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let products = ss.getSheetByName(PRODUCTS_SHEET_NAME) || ss.insertSheet(PRODUCTS_SHEET_NAME);
  if (products.getLastRow() === 0) {
    products.appendRow(['id','name','category','unit','price','description','image','active']);
    products.appendRow(['entrecote','אנטריקוט פרימיום','נתחי בקר','ק״ג',199.9,'נתח פרימיום לצלייה','','TRUE']);
    products.appendRow(['picanha','פיקניה','נתחי בקר','ק״ג',171.5,'פיקניה איכותית לצלייה','','TRUE']);
    products.appendRow(['denver','דנוור סטייק','סטייקים','ק״ג',139.9,'סטייק דנוור עסיסי','','TRUE']);
    products.appendRow(['asado','אסאדו','נתחי בקר','ק״ג',100.3,'אסאדו לבישול ארוך/גריל','','TRUE']);
    products.appendRow(['kebab','קבב עגל טלה','קצבייה','מארז',65,'מארז קבב איכותי','','TRUE']);
  }
  let orders = ss.getSheetByName(ORDERS_SHEET_NAME) || ss.insertSheet(ORDERS_SHEET_NAME);
  if (orders.getLastRow() === 0) orders.appendRow(['תאריך','מספר הזמנה','שם לקוח','טלפון','אימייל','יישוב','כתובת','סוג הזמנה','הערות','אישור שיווקי','מוצרים','סה"כ',LINK_HEADER_NAME]);
}

function testWebsiteOrder() {
  const fakeData = {customer:{name:'בדיקת מערכת קומפס', phone:'0500000000', city:'כפר סבא', orderType:'איסוף עצמי', notes:'בדיקה ידנית'}, items:[{id:'entrecote', name:'אנטריקוט פרימיום', quantity:2, unit:'ק״ג', price:199.9, lineTotal:399.8}], total:399.8};
  const e = {postData:{contents:JSON.stringify(fakeData), type:'text/plain'}};
  const result = doPost(e);
  Logger.log(result.getContent());
}

function testProducts() {
  const result = doGet();
  Logger.log(result.getContent());
}

function authorizeMail() {
  MailApp.sendEmail(NOTIFICATION_EMAIL, 'בדיקת הרשאת אימייל - קומפס כפר סבא', 'אם קיבלת את ההודעה הזו, הרשאת MailApp עובדת.');
}
