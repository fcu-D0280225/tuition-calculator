/**
 * ReferralPage — 純靜態推薦頁面
 *
 * 安全設計說明：
 * - 無任何 user input → 無 XSS / Injection 向量
 * - 無 dangerouslySetInnerHTML → React 自動跳脫所有輸出
 * - 外部連結加 rel="noopener noreferrer"
 * - 無 URL 參數渲染進 DOM
 */

const FEATURES = [
  {
    icon: '📋',
    title: '課程全管理',
    desc: '家教課、團課一手掌握，支援拖曳排序、費率彈性設定，帶走課表不費力。',
  },
  {
    icon: '✅',
    title: '即時點名出席',
    desc: '手機 PWA 點名，課後一鍵傳 Line 出席通知給家長，零落差溝通。',
  },
  {
    icon: '💰',
    title: '學費 × 薪資結算',
    desc: '每月學費、老師薪資自動試算，明細清楚，再也不用手動 Excel。',
  },
  {
    icon: '📄',
    title: '帳單分享給家長',
    desc: '一鍵產生家長專屬帳單連結，家長掃描即看費用明細，省去逐一說明時間。',
  },
  {
    icon: '🤖',
    title: 'AI 助理隨時待命',
    desc: '內建 Claude AI，查學生資料、問收費規則、操作系統，用說的就好。',
  },
  {
    icon: '🌙',
    title: '深淺主題 × 多帳號權限',
    desc: '老師、管理員分層權限，深色模式保護夜間眼睛，適合長時間使用。',
  },
]

const STEPS = [
  { step: '01', text: '聯絡我們，取得專屬邀請碼' },
  { step: '02', text: '建立帳號，5 分鐘完成基本設定' },
  { step: '03', text: '匯入學生名單，開始第一次點名' },
]

export default function ReferralPage() {
  return (
    <div className="referral-shell">
      {/* Hero */}
      <section className="referral-hero">
        <div className="referral-hero-badge">補習班管理系統</div>
        <h1 className="referral-hero-title">讓行政工作<br />回歸本來的簡單</h1>
        <p className="referral-hero-sub">
          專為小型補習班、家教老師設計的一站式管理平台——<br />
          點名、學費、薪資、帳單，全部搞定。
        </p>
        <a href="/" className="referral-cta-btn">
          前往登入
        </a>
      </section>

      {/* Features */}
      <section className="referral-section">
        <h2 className="referral-section-title">為什麼選擇我們</h2>
        <div className="referral-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="referral-card">
              <span className="referral-card-icon" role="img" aria-label={f.title}>
                {f.icon}
              </span>
              <h3 className="referral-card-title">{f.title}</h3>
              <p className="referral-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="referral-section referral-section--alt">
        <h2 className="referral-section-title">三步驟開始使用</h2>
        <div className="referral-steps">
          {STEPS.map((s) => (
            <div key={s.step} className="referral-step">
              <span className="referral-step-num">{s.step}</span>
              <p className="referral-step-text">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="referral-section referral-cta-section">
        <h2 className="referral-cta-title">立即體驗，免費試用</h2>
        <p className="referral-cta-sub">已有帳號？直接登入開始使用。</p>
        <a href="/" className="referral-cta-btn">
          回到登入頁
        </a>
      </section>

      <footer className="referral-footer">
        © {new Date().getFullYear()} 補習班管理系統｜保留一切權利
      </footer>
    </div>
  )
}
