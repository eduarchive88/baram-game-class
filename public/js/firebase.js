/**
 * firebase.js - Firebase 초기화 및 공통 모듈
 * 바람의 나라 교육용 RPG - Firebase 연동
 */

// Firebase 설정 객체 (SDK 설정)
// Vercel 환경변수에서 주입받거나 기본값을 사용함
const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyD9mTB0VRX8pzGJKVb6C85E3fAczuASEmE",
  authDomain: "baram-game-class.firebaseapp.com",
  databaseURL: "https://baram-game-class-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "baram-game-class",
  storageBucket: "baram-game-class.firebasestorage.app",
  messagingSenderId: "336469584434",
  appId: "1:336469584434:web:ac9cda82e2d072ebef2a2b"
};

// Firebase 앱 초기화
firebase.initializeApp(firebaseConfig);

// Firebase 서비스 참조 (전역 변수로 노출)
window.auth = firebase.auth();
window.db = firebase.firestore();
window.rtdb = firebase.database();

const auth = window.auth;
const db = window.db;
const rtdb = window.rtdb;

// GM(교사) 관리자 이메일 목록 - Vercel/Cloudflare 환경변수에서 주입받거나 기본값 사용
window.GM_EMAILS = window.GM_EMAILS || ["eduarchive88@gmail.com"];
const GM_EMAILS = window.GM_EMAILS;

/**
 * 현재 로그인한 사용자가 GM인지 확인하는 헬퍼 함수
 * @param {firebase.User} user - Firebase Auth 유저 객체
 * @returns {boolean} GM 여부
 */
function isGM(user) {
  if (!user) return false;
  return GM_EMAILS.includes(user.email);
}

// 한글 주석: Auth 상태 변화 리스너를 외부 모듈에서 쉽게 바인딩할 수 있도록 export
console.log("[Firebase] 초기화 완료 - 프로젝트:", firebaseConfig.projectId);
