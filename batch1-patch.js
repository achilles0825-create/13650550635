/* =====================================================================
   批次 1 補丁（貼進原本 <script type="module"> 裡，const storage = ... 那行之後）
   包含：toast、深色模式、防洗版、未讀數量、回覆、編輯/收回、
        輸入中、表情選擇器、圖片壓縮、跨遊戲金幣
   另外要做的 5 處小修改，請看檔案最下方「整合步驟」
   ===================================================================== */

// ---------- 1) Toast（取代 alert）----------
const toastBox = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast-box' }));
window.toast = (m, ms = 2600) => {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = m;
  toastBox.append(t); setTimeout(() => t.remove(), ms);
};
window.alert = m => toast(String(m));   // 原本所有 alert 自動變 toast

// ---------- 2) 樣式（含深色模式）----------
const st = document.createElement('style');
st.textContent = `
#toast-box{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:#273246;color:#fff;padding:10px 18px;border-radius:20px;font-size:15px;box-shadow:0 4px 12px #0005;max-width:90vw}
.badge{background:#e74c3c;color:#fff;border-radius:12px;min-width:22px;height:22px;padding:0 6px;font-size:13px;font-weight:bold;display:flex;align-items:center;justify-content:center}
.quote{border-left:3px solid #4a86e8;background:#0001;padding:4px 8px;border-radius:4px;font-size:13px;opacity:.85}
.msg-tools{display:none;gap:4px;margin-top:2px}.message:hover .msg-tools{display:flex}
.msg-tools button{border:0;background:#0002;border-radius:10px;padding:2px 8px;cursor:pointer;font-size:12px}
.edited{font-size:10px;opacity:.6}.recalled{font-style:italic;opacity:.6}
#typing-bar{font-size:13px;color:#fff;padding:2px 16px;min-height:18px;background:#0002}
#reply-bar{display:none;background:#e8eefc;padding:6px 14px;font-size:13px;justify-content:space-between;align-items:center}
#emoji-panel{display:none;position:absolute;bottom:70px;left:10px;right:10px;background:#fff;border-radius:12px;padding:8px;box-shadow:0 4px 14px #0004;flex-wrap:wrap;gap:2px;z-index:12;max-height:160px;overflow:auto}
#emoji-panel span{font-size:26px;cursor:pointer;padding:3px}
body.dark{background:#10141c}
body.dark .container,body.dark #sidebar{background:#1b2130;color:#e5e9f0}
body.dark .list-item{border-color:#2a3246}body.dark .list-item:hover{background:#252d40}
body.dark .item-name{color:#e5e9f0}body.dark .sidebar-section{background:#232b3d;color:#9aa5b8}
body.dark .add-friend-box{background:#1f2636;border-color:#2a3246}
body.dark #chat-window{background:#151a26}body.dark .other .bubble{background:#2a3246;color:#e5e9f0}
body.dark #input-area{background:#1b2130}body.dark #message-input{background:#2a3246;color:#fff;border-color:#3a4560}
body.dark .modal-box{background:#1f2636;color:#e5e9f0}`;
document.head.append(st);

const darkBtn = document.createElement('button');
darkBtn.style.cssText = 'background:none;border:1px solid #fff;color:#fff;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:12px';
const applyDark = on => { document.body.classList.toggle('dark', on); darkBtn.textContent = on ? '☀️' : '🌙'; };
try { applyDark(localStorage.getItem('dark') === '1'); } catch (e) { applyDark(false); }
darkBtn.onclick = () => { const on = !document.body.classList.contains('dark'); applyDark(on); try { localStorage.setItem('dark', on ? '1' : '0'); } catch (e) {} };
document.getElementById('logout-btn').before(darkBtn);

// ---------- 3) 防洗版：5 秒內最多 5 則 ----------
const sendTimes = [];
function canSend() {
  const n = Date.now();
  while (sendTimes.length && n - sendTimes[0] > 5000) sendTimes.shift();
  if (sendTimes.length >= 5) { toast('發太快了，休息一下 🐢'); return false; }
  sendTimes.push(n); return true;
}

// ---------- 4) 跨遊戲金幣（聊天/餵魚 → 槍戰金幣）----------
// 注意：金幣在前端發放，有心人可改程式刷幣；要防作弊必須改用規則或 Cloud Functions
let chatCoinToday = 0;
function addCoins(n) {
  if (!myUid) return;
  if (typeof G !== 'undefined' && G.running) { G.money += n; G.dirty = true; return; }
  runTransaction(ref(db, `shooter/saves/${myUid}/money`), c => (Number(c) || 0) + n).catch(() => {});
}

// ---------- 5) 取代原本的 sendMessage（先刪掉舊的 function sendMessage）----------
let replyTo = null;
const replyBar = Object.assign(document.createElement('div'), { id: 'reply-bar' });
const typingBar = Object.assign(document.createElement('div'), { id: 'typing-bar' });
document.getElementById('messages').after(typingBar);
document.getElementById('input-area').before(replyBar);
function setReply(id, data) {
  const t = data.type === 'text' ? data.text : '[' + data.type + ']';
  replyTo = { id, name: data.senderName || '?', text: String(t).slice(0, 60) };
  replyBar.style.display = 'flex';
  replyBar.innerHTML = '';
  const s = document.createElement('span'); s.textContent = '↩ 回覆 ' + replyTo.name + '：' + replyTo.text;
  const x = document.createElement('button'); x.textContent = '✕'; x.onclick = clearReply;
  replyBar.append(s, x); messageInput.focus();
}
function clearReply() { replyTo = null; replyBar.style.display = 'none'; }

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !myUid || !currentChat || !canSend()) return;
  const msg = { type: 'text', text: text.slice(0, 2000), senderId: myUid, senderName: myNickname, timestamp: serverTimestamp() };
  if (replyTo) msg.reply = replyTo;
  const room = currentChat.id;
  push(ref(db, `chats/${room}/messages`), msg).then(() => {
    messageInput.value = ''; clearReply();
    set(ref(db, `chats/${room}/lastMsg`), { s: myUid, ts: Date.now() });
    set(ref(db, `chats/${room}/typing/${myUid}`), null);
    if (chatCoinToday < 20) { chatCoinToday++; addCoins(1); }
  }).catch(e => toast('發送失敗：' + e.message));
}

// ---------- 6) 訊息裝飾：回覆引用 / 編輯 / 收回 ----------
// 在 displayMessage 裡 wrapper.appendChild(bubble) 之前呼叫：decorate(wrapper, bubble, id, data);
function decorate(wrapper, bubble, id, data) {
  const isMe = data.senderId === myUid;
  if (data.recalled) {
    bubble.textContent = '（訊息已收回）'; bubble.classList.add('recalled');
  } else {
    if (data.reply) {
      const q = document.createElement('div'); q.className = 'quote';
      q.textContent = data.reply.name + '：' + data.reply.text; bubble.prepend(q);
    }
    if (data.edited) { const e = document.createElement('span'); e.className = 'edited'; e.textContent = '（已編輯）'; bubble.append(e); }
  }
  bubble.ondblclick = () => { if (!data.recalled) setReply(id, data); };
  if (isMe && !data.recalled) {
    const tools = document.createElement('div'); tools.className = 'msg-tools';
    const mref = () => ref(db, `chats/${currentChat.id}/messages/${id}`);
    if (data.type === 'text') {
      const eb = document.createElement('button'); eb.textContent = '✎ 編輯';
      eb.onclick = async () => {
        const v = prompt('編輯訊息', data.text);
        if (v && v.trim() && v !== data.text) update(mref(), { text: v.trim().slice(0, 2000), edited: true }).catch(e => toast(e.message));
      };
      tools.append(eb);
    }
    const rb = document.createElement('button'); rb.textContent = '↩ 收回';
    rb.onclick = () => { if (confirm('收回這則訊息？')) update(mref(), { recalled: true, text: null, url: null }).catch(e => toast(e.message)); };
    tools.append(rb); wrapper.append(tools);
  }
}

// ---------- 7) 輸入中提示 + 未讀數量 ----------
let typingT = null;
messageInput.addEventListener('input', () => {
  if (!currentChat || !myUid) return;
  const r = ref(db, `chats/${currentChat.id}/typing/${myUid}`);
  set(r, myNickname); onDisconnect(r).remove();
  clearTimeout(typingT); typingT = setTimeout(() => remove(r).catch(() => {}), 2500);
});
// 在 openChat 內、建立 chatRef 之後呼叫，並把回傳的 unsub 併進 currentChatUnsubscribe
function watchTyping(roomId) {
  return onValue(ref(db, `chats/${roomId}/typing`), s => {
    const names = Object.entries(s.val() || {}).filter(([u]) => u !== myUid).map(([, n]) => n);
    typingBar.textContent = names.length ? names.join('、') + ' 正在輸入…' : '';
  });
}

const unread = {}, seenFirst = {}, watchedRooms = new Set();
function watchUnread(roomId) {
  if (watchedRooms.has(roomId)) return; watchedRooms.add(roomId);
  const u = onValue(ref(db, `chats/${roomId}/lastMsg`), s => {
    const v = s.val(); if (!v) return;
    if (!seenFirst[roomId]) { seenFirst[roomId] = true; return; }          // 第一次載入不算
    if (v.s !== myUid && !(currentChat && currentChat.id === roomId)) unread[roomId] = (unread[roomId] || 0) + 1;
    applyBadges();
  });
  unsubscribes.push(u);
}
function applyBadges() {
  document.querySelectorAll('[data-room]').forEach(el => {
    let b = el.querySelector('.badge'); const n = unread[el.dataset.room] || 0;
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'badge'; el.append(b); }
    b.textContent = n > 99 ? '99+' : n;
  });
}
new MutationObserver(applyBadges).observe(document.getElementById('sidebar'), { childList: true, subtree: true });

// ---------- 8) 表情選擇器 ----------
const emojiBtn = Object.assign(document.createElement('button'), { textContent: '😊' });
emojiBtn.style.cssText = 'background:none;border:0;font-size:26px;cursor:pointer';
const emojiPanel = Object.assign(document.createElement('div'), { id: 'emoji-panel' });
'😀😁😂🤣😊😍😘😎🤔😭😡😴🥳😱🙄👍👎👏🙏💪🔥✨💯❤️💔🎉🎮🔫🐠🐟🦈🐢🍞🍜🍺⚽🌟'.match(/\p{Extended_Pictographic}\uFE0F?/gu).forEach(e => {
  const s = document.createElement('span'); s.textContent = e;
  s.onclick = () => { messageInput.value += e; messageInput.focus(); }; emojiPanel.append(s);
});
chatWindow.append(emojiPanel);
emojiBtn.onclick = () => { emojiPanel.style.display = emojiPanel.style.display === 'flex' ? 'none' : 'flex'; };
document.getElementById('file-btn').after(emojiBtn);

// ---------- 9) 圖片壓縮（上傳前）----------
async function compressImage(file, max = 1280, q = 0.8) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}

/* =====================================================================
   整合步驟（原檔要改的 5 個地方）
   ---------------------------------------------------------------------
   ① import firebase-database 那行加上：  query, limitToLast, onChildChanged
   ② 刪掉原本的 function sendMessage() {...}（上面已有新版）
   ③ openChat() 內：
        const chatRef = ref(db, `chats/${roomId}/messages`);
        const q = query(chatRef, limitToLast(50));                 // 只載入最後 50 則
        const unsubAdded = onChildAdded(q, s => displayMessage(s.key, s.val()));
        const unsubChanged = onChildChanged(chatRef, s => {        // 編輯/收回即時更新
            const el = document.getElementById(`msg-${s.key}`); if (el) el.remove();
            displayMessage(s.key, s.val());
        });
        const unsubTyping = watchTyping(roomId);
        unread[roomId] = 0; applyBadges(); clearReply();
        currentChatUnsubscribe = () => { unsubAdded(); unsubChanged(); unsubRemoved(); unsubTyping(); };
      （onChildChanged 重畫時訊息會跑到最底，若介意可改成就地更新內容）
   ④ displayMessage() 內 wrapper.appendChild(bubble) 之前加：
        decorate(wrapper, bubble, id, data);
      檔案上傳 handler 第一行改成：
        const file = await compressImage(e.target.files[0]);
   ⑤ 讓未讀紅點找得到房間：
        updateFriendListUI 內 div 建好後：  div.dataset.room = roomId; watchUnread(roomId);
        loadGroups 內 div 建好後：          div.dataset.room = groupId; watchUnread(groupId);
        publicChatItem 啟動時一次：        publicChatItem.dataset.room = 'public_lobby'; watchUnread('public_lobby');
      餵魚成功後（feedFishBtn 的 click 內）加：addCoins(10);

   ---------------------------------------------------------------------
   Firebase 規則（新增路徑，加進你現有 rules）：
   "chats": { "$room": {
       "typing":  { "$uid": { ".write": "auth.uid === $uid" } },
       "lastMsg": { ".write": "auth != null" },
       "messages": { "$mid": {
           ".write": "auth != null && (!data.exists() || data.child('senderId').val() === auth.uid)"
       } }
   } }
   ===================================================================== */
