import { useRef, useState } from 'react'
import { apiAiChat } from '../data/api.js'

const WELCOME = `你好！我是補習班 AI 助理。你可以問我：

- 「本月財務狀況如何？」
- 「上個月哪位學生費用最高？」
- 「最近有哪些課堂備註值得關注？」
- 「老師薪資本月是多少？」
- 「雜項支出本月花了多少？」
- 「根據課堂備註，幫我總結各課程的教學狀況」`

export default function AiAssistantPage() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: WELCOME },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError('')
    scrollToBottom()

    try {
      // Only send actual conversation turns (exclude the welcome message)
      const conversationHistory = newMessages.filter((_, i) => !(i === 0 && newMessages[0].role === 'assistant'))
      const reply = await apiAiChat(conversationHistory)
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      scrollToBottom()
    } catch (e) {
      setError(e.message || '呼叫 AI 失敗，請確認 ANTHROPIC_API_KEY 已設定')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleClear() {
    setMessages([{ role: 'assistant', content: WELCOME }])
    setError('')
  }

  return (
    <div className="page ai-page">
      <div className="page-header">
        <h1>AI 助理</h1>
        <button type="button" className="btn-ghost" onClick={handleClear}>清除對話</button>
      </div>

      <div className="ai-chat-container">
        <div className="ai-chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ai-message--${msg.role}`}>
              <div className="ai-message-label">
                {msg.role === 'user' ? '你' : 'AI 助理'}
              </div>
              <div className="ai-message-content">
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>
                    {line}
                    {j < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="ai-message ai-message--assistant">
              <div className="ai-message-label">AI 助理</div>
              <div className="ai-message-content ai-thinking">
                <span className="ai-dot" /><span className="ai-dot" /><span className="ai-dot" />
              </div>
            </div>
          )}
          {error && (
            <div className="ai-message ai-message--error">
              <div className="ai-message-content">{error}</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="ai-chat-input-row">
          <textarea
            ref={textareaRef}
            className="ai-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入問題，按 Enter 送出（Shift+Enter 換行）"
            rows={2}
            disabled={loading}
          />
          <button
            type="button"
            className="btn-primary ai-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? '…' : '送出'}
          </button>
        </div>
      </div>
    </div>
  )
}
