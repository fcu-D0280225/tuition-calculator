import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `你是一位補習班經營助理，幫助經營者分析學費、薪資、上課紀錄、雜項支出等資料，並提供洞察與建議。

今天日期：${new Date().toISOString().slice(0, 10)}

你可以呼叫工具查詢資料庫，再根據結果回答問題。以下是你能做的事：
- 查詢某段時間的財務總覽（學費收入、老師薪資、雜項支出、淨利）
- 查詢上課紀錄，並根據「課堂備註」提出教學改善建議
- 分析各學生收費、各老師薪資
- 查詢雜項支出分類
- 列出學生、老師、課程清單
- 綜合多筆資料給出完整的經營建議

請用繁體中文回答。回答要具體、有數字佐證，不要泛泛而談。
如果使用者問的是現在的狀況，請自行決定合理的日期區間（例如本月：${new Date().toISOString().slice(0, 7)}-01 到今天）。`

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
