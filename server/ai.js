import Anthropic from '@anthropic-ai/sdk'
import { execSync } from 'node:child_process'

// ── OAuth token from Claude Code keychain (macOS) ──────────────────────────
// Falls back to ANTHROPIC_API_KEY if keychain is unavailable.
let _cachedToken = null
let _tokenExpiry = 0

function getClient() {
  // If explicit API key is set, use it directly
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  // Re-use cached OAuth token until 5 min before expiry
  if (_cachedToken && Date.now() < _tokenExpiry - 300_000) {
    return new Anthropic({ authToken: _cachedToken })
  }
  try {
    const raw = execSync('security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null', { timeout: 3000 }).toString().trim()
    const creds = JSON.parse(raw)
    const { accessToken, expiresAt } = creds.claudeAiOauth
    _cachedToken = accessToken
    _tokenExpiry = expiresAt
    return new Anthropic({ authToken: accessToken })
  } catch {
    throw new Error('未設定 ANTHROPIC_API_KEY，且無法從 Claude Code keychain 取得 OAuth token。請在 .env 中設定 ANTHROPIC_API_KEY。')
  }
}

const SYSTEM_PROMPT = `你是一位補習班管理系統的 AI 助理，同時擔任兩種角色：

A. 「經營分析師」——幫助經營者分析學費、薪資、上課紀錄、雜項支出等資料，並提供洞察與建議。
B. 「操作教學員」——回答使用者「怎麼用這個系統」「某功能在哪一頁」「OO 步驟怎麼做」等操作問題。

今天日期：${new Date().toISOString().slice(0, 10)}

──────────────────────────────────────
【A. 資料分析能力（呼叫工具）】

當問題涉及實際資料時，請呼叫工具查詢資料庫再回答。可做的事：
- 查詢某段時間的財務總覽（學費收入、老師薪資、雜項支出、淨利）
- 查詢上課紀錄，並根據「課堂備註」提出教學改善建議
- 分析各學生收費、各老師薪資
- 查詢雜項支出分類
- 列出學生、老師、課程清單
- 綜合多筆資料給出完整的經營建議

如果使用者問的是現在的狀況，請自行決定合理的日期區間（例如本月：${new Date().toISOString().slice(0, 7)}-01 到今天）。
回答要具體、有數字佐證，不要泛泛而談。

──────────────────────────────────────
【B. 系統操作說明（不必呼叫工具，直接回答）】

當問題是「怎麼操作」「在哪裡」「步驟」這類，直接根據以下知識回答，不要呼叫資料工具。

# 側邊選單結構（依分組）

- 課程
  - 家教課（courses）：管理家教課程，設定每小時單價、老師時薪
  - 團課（groups）：管理團課，設定上課星期、持續時間、月費
- 人員
  - 學生（students）：新增 / 編輯 / 刪除學生；點「報名」可進入該學生的課程報名頁
  - 老師（teachers）：新增 / 編輯 / 刪除老師
- 上課紀錄
  - 家教課上課紀錄（lessons_tutoring）：登打家教課每堂紀錄（學生 / 老師 / 課程 / 時數 / 日期 / 備註），可單堂覆寫單價
  - 團課上課紀錄（lessons_group）：登打團課堂次紀錄
- 紀錄
  - 點名（attendance）：選團課與日期 → 自動載入名單 → 勾選出席 → 儲存（PWA 主要使用頁）
  - 教材（materials）：管理教材品項與單價，並登打學生領取紀錄
  - 雜項支出（misc）：登打房租 / 水電 / 行銷 / 其他等支出
- 課表（schedule）：以週曆檢視所有課堂安排
- 結算
  - 學費結算（settlement_tuition）：依日期區間產出每位學生的學費明細（家教 + 團課 + 教材），可下載 PDF
  - 老師薪資結算（settlement_salary）：依日期區間產出每位老師的薪資明細，可下載 PDF
  - 結算總覽（settlement）：學費 + 薪資總覽
- 管理
  - 財務總覽（dashboard）：營收、成本、雜支、淨利的儀表板（含損益報表）
  - AI 助理（ai_assistant）：你目前所在的頁面
  - 使用者管理（users）：僅管理員可見，建立帳號、設定權限群組

# 常見操作步驟

## 第一次使用（基本設定）
1. 人員 → 老師：新增老師
2. 人員 → 學生：新增學生
3. 課程 → 家教課：新增課程並填入每小時費用
4. （選填）紀錄 → 教材：新增教材品項並填入單價
5. （選填）課程 → 團課：新增團課並填入月費

## 日常記錄
- 登打家教課：上課紀錄 → 家教課上課紀錄 → 選學生 / 老師 / 課程 → 填時數與日期
- 點名（團課）：紀錄 → 點名 → 選團課與日期 → 勾選出席學生 → 儲存
- 登打教材領取：紀錄 → 教材 → 選學生、教材品項與數量
- 登打雜項支出：紀錄 → 雜項支出 → 選分類、金額、日期

## 每期結算與 PDF 匯出
1. 結算 → 學費結算（或老師薪資結算）
2. 選擇起始與結束日期 → 點「產生報表」
3. 整份下載：頁面上方「下載 PDF」
4. 個別下載：每位學生 / 老師那一列的「PDF」按鈕

## 計費邏輯（使用者常問）
- 家教課：總時數 × 課程單價（可單堂覆寫 unit_price）
- 團課：出席月份數 × 月費（跨 2 個月就收 2 倍月費；只上團課的學生也會出現在帳單）
- 教材：數量 × 單價
- 老師薪資：總時數 × 鐘點費，依課程分行顯示

## 權限與帳號
- 使用者管理只有管理員看得到
- 一般使用者透過「群組」分配頁面權限
- 老師帳號（綁 teacher_id 且非管理員）登入後預設導向「點名」頁

## PWA 安裝
- Android Chrome：右上 ⋮ →「新增至主畫面」
- iOS Safari：分享 ⬆ →「加入主畫面」（iOS 限 Safari）

──────────────────────────────────────

請用繁體中文回答。
- 操作問題：直接給步驟，務必標明在哪個選單路徑（例如「人員 → 學生」）。
- 資料問題：先呼叫工具，再給具體數字與洞察。
- 若問題同時涉及兩者（例如「我這個月薪資怎麼算的，要去哪看？」），先說操作位置，再呼叫工具給數字。`

const TOOLS = [
  {
    name: 'get_financial_dashboard',
    description: '取得指定期間的財務總覽：學費收入、老師薪資、教材成本、雜項支出分類、淨利',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '開始日期，格式 YYYY-MM-DD' },
        to:   { type: 'string', description: '結束日期，格式 YYYY-MM-DD' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_lesson_records',
    description: '取得上課紀錄列表，包含課堂備註（note），可用來分析教學狀況',
    input_schema: {
      type: 'object',
      properties: {
        from:       { type: 'string', description: '開始日期，格式 YYYY-MM-DD' },
        to:         { type: 'string', description: '結束日期，格式 YYYY-MM-DD' },
        student_id: { type: 'string', description: '學生 ID（選填，不填則查全部）' },
        teacher_id: { type: 'string', description: '老師 ID（選填）' },
        course_id:  { type: 'string', description: '課程 ID（選填）' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_tuition_settlement',
    description: '取得學費結算，按學生分類，含家教課、團課、教材費明細',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '開始日期' },
        to:   { type: 'string', description: '結束日期' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_salary_settlement',
    description: '取得老師薪資結算，按老師分類，含課程時數與金額',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '開始日期' },
        to:   { type: 'string', description: '結束日期' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_misc_expenses',
    description: '取得雜項支出列表，可依分類篩選',
    input_schema: {
      type: 'object',
      properties: {
        from:     { type: 'string', description: '開始日期' },
        to:       { type: 'string', description: '結束日期' },
        category: { type: 'string', description: '分類（選填）：房租、水電、行銷、其他 等' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'get_students',
    description: '取得所有學生清單，含學生 ID、姓名、是否在籍',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_teachers',
    description: '取得所有老師清單，含老師 ID、姓名',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_courses',
    description: '取得所有家教課程清單，含課程 ID、名稱、時薪',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

async function runTool(name, input, db) {
  switch (name) {
    case 'get_financial_dashboard': {
      const [tuition, salary, miscByCategory] = await Promise.all([
        db.settlementTuition(input.from, input.to),
        db.settlementSalary(input.from, input.to),
        db.sumMiscExpensesByCategory(input.from, input.to),
      ])
      const totalTuition = tuition.reduce((s, r) => s + r.total, 0)
      const totalSalary  = salary.reduce((s, r) => s + r.total, 0)
      const totalMisc    = miscByCategory.reduce((s, r) => s + parseFloat(r.total || 0), 0)
      return {
        period: { from: input.from, to: input.to },
        revenue: { tuition: totalTuition },
        cost: { salary: totalSalary },
        expenses: { total: totalMisc, by_category: miscByCategory },
        profit: totalTuition - totalSalary - totalMisc,
      }
    }
    case 'get_lesson_records': {
      const rows = await db.listLessons({
        from:      input.from,
        to:        input.to,
        studentId: input.student_id,
        teacherId: input.teacher_id,
        courseId:  input.course_id,
      })
      // 只回傳有備註的 + 摘要統計，避免回傳過多 token
      const withNotes = rows.filter(r => r.note && r.note.trim())
      return {
        total_lessons: rows.length,
        lessons_with_notes: withNotes.length,
        notes_summary: withNotes.map(r => ({
          date:         r.date,
          student_name: r.student_name,
          teacher_name: r.teacher_name,
          course_name:  r.course_name,
          hours:        r.hours,
          note:         r.note,
        })),
        status_counts: rows.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        }, {}),
      }
    }
    case 'get_tuition_settlement':
      return db.settlementTuition(input.from, input.to)
    case 'get_salary_settlement':
      return db.settlementSalary(input.from, input.to)
    case 'get_misc_expenses':
      return db.listMiscExpenses({ from: input.from, to: input.to, category: input.category })
    case 'get_students':
      return db.listStudents()
    case 'get_teachers':
      return db.listTeachers()
    case 'get_courses':
      return db.listCourses()
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function runAiChat(messages, db) {
  // messages: Array<{ role: 'user'|'assistant', content: string }>
  // db: object with all DB functions

  const anthropicMessages = messages.map(m => ({ role: m.role, content: m.content }))
  const client = getClient()

  let response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    tools:      TOOLS,
    messages:   anthropicMessages,
  })

  // Agentic loop: keep calling until stop_reason is 'end_turn'
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')

    // Run all tool calls (can be parallel)
    const toolResults = await Promise.all(
      toolUseBlocks.map(async block => {
        try {
          const result = await runTool(block.name, block.input, db)
          return {
            type:        'tool_result',
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          }
        } catch (err) {
          return {
            type:        'tool_result',
            tool_use_id: block.id,
            is_error:    true,
            content:     `Error: ${err.message}`,
          }
        }
      })
    )

    // Continue the conversation with tool results
    anthropicMessages.push(
      { role: 'assistant', content: response.content },
      { role: 'user',      content: toolResults },
    )

    response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      tools:      TOOLS,
      messages:   anthropicMessages,
    })
  }

  // Extract the final text response
  const textBlocks = response.content.filter(b => b.type === 'text')
  return textBlocks.map(b => b.text).join('\n')
}
