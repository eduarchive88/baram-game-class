const fs = require('fs');
const path = require('path');

// 변수 주입용 환경변수 리스트
const envVars = {
  PLACEHOLDER_API_KEY: process.env.FIREBASE_API_KEY,
  PLACEHOLDER_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  PLACEHOLDER_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  PLACEHOLDER_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  PLACEHOLDER_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  PLACEHOLDER_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
  PLACEHOLDER_APP_ID: process.env.FIREBASE_APP_ID,
};

// GM 이메일 목록 주입
const gmEmails = process.env.GM_EMAILS ? process.env.GM_EMAILS.split(',') : ["eduarchive88@gmail.com"];

const firebaseJsPath = path.join(__dirname, 'public', 'js', 'firebase.js');

if (fs.existsSync(firebaseJsPath)) {
  let content = fs.readFileSync(firebaseJsPath, 'utf8');

  // Firebase Config 주입
  for (const [placeholder, value] of Object.entries(envVars)) {
    if (value) {
      // 다양한 형식의 플레이스홀더 치환 (따옴표 포함/미포함)
      const regex = new RegExp(placeholder, 'g');
      content = content.replace(regex, value);
      console.log(`[Build] Replaced ${placeholder} with actual value`);
    } else {
      console.warn(`[Build] Warning: No value for ${placeholder}`);
    }
  }

  // GM_EMAILS 주입
  if (process.env.GM_EMAILS) {
    const gmEmailsStr = JSON.stringify(gmEmails);
    content = content.replace('window.GM_EMAILS || ["eduarchive88@gmail.com"]', gmEmailsStr);
    console.log(`[Build] Injected GM_EMAILS: ${gmEmailsStr}`);
  }

  fs.writeFileSync(firebaseJsPath, content);
  console.log('[Build] Successfully updated public/js/firebase.js');
} else {
  console.error('[Build] Error: public/js/firebase.js not found');
  process.exit(1);
}
