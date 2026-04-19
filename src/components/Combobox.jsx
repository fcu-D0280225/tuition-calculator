import { useState, useRef, useEffect } from 'react'

/**
 * Combobox — 可輸入文字的搜尋下拉
 *
 * Props:
 *   items      [{ id, name }]  選項清單
 *   value      string          目前選中的 id（''  = 未選）
 *   onChange   (id) => void    選中後回傳 id
 *   placeholder string
 *   allLabel   string          若給定，清單最上方會有一筆「全部」選項（value = ''）
 */
export default function Combobox({ items, value, onChange, placeholder = '搜尋…', allLabel }) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef(null)

  // 當外部 value 或 items 變動時，同步顯示文字
  useEffect(() => {
    if (!value) { setInputVal(''); return }
    const found = items.find(i => i.id === value)
    if (found) setInputVal(found.name)
  }, [value, items])

  const filtered = inputVal.trim()
    ? items.filter(i => i.name.toLowerCase().includes(inputVal.toLowerCase()))
    : items

  function handleChange(e) {
    setInputVal(e.target.value)
    setOpen(true)
    // 如果清空輸入，取消選取
    if (!e.target.value) onChange('')
  }

  function handleFocus() {
    setOpen(true)
  }

  function handleSelect(id, name) {
    setInputVal(name)
    onChange(id)
    setOpen(false)
  }

  function handleBlur() {
    // 延遲讓 onMouseDown 先觸發
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setOpen(false)
        // 若有選中值，恢復顯示名稱；否則清空
        if (value) {
          const found = items.find(i => i.id === value)
          setInputVal(found ? found.name : '')
        } else {
          setInputVal('')
        }
      }
    }, 150)
  }

  const showList = open && (allLabel !== undefined || filtered.length > 0)

  return (
    <div className="combobox" ref={containerRef}>
      <input
        type="text"
        className="combobox-input"
        value={inputVal}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {showList && (
        <ul className="combobox-list">
          {allLabel !== undefined && (
            <li
              className={`combobox-item${!value ? ' combobox-item--selected' : ''}`}
              onMouseDown={() => handleSelect('', allLabel)}
            >
              {allLabel}
            </li>
          )}
          {filtered.map(item => (
            <li
              key={item.id}
              className={`combobox-item${item.id === value ? ' combobox-item--selected' : ''}`}
              onMouseDown={() => handleSelect(item.id, item.name)}
            >
              {item.name}
            </li>
          ))}
          {filtered.length === 0 && !allLabel && (
            <li className="combobox-empty">找不到符合的選項</li>
          )}
        </ul>
      )}
    </div>
  )
}
